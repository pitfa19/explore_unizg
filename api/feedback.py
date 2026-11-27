"""POST /api/feedback. A visitor report, stored in a private Google Sheet
when the Apps Script webhook env vars exist.

FEEDBACK_WEBHOOK_URL and FEEDBACK_WEBHOOK_SECRET are read from the
environment. They are never written to the repository. Missing either
one returns 503.

The webhook is a container-bound Google Apps Script web app that appends
a row to the "explore-unizg feedback" sheet. The shared secret is sent
in the JSON body (Apps Script web apps strip custom HTTP headers).
"""
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from zoneinfo import ZoneInfo

WINDOW_S = 600
MAX_PER_WINDOW = 5
MAX_MESSAGE = 2000
MAX_BODY = 16000
_HITS = {}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CONTEXT_KEYS = (
    "url", "viewport", "timestamp", "faculty", "programme",
    "course", "section", "selectionCount", "status",
)
ZAGREB = ZoneInfo("Europe/Zagreb")
SHEET_COLUMNS = (
    "created_at", "message", "email", "page", "sastavnica",
    "studij", "course", "viewport", "user_agent", "context_json",
)


def reset_rates():
    _HITS.clear()


def credentials():
    url = (os.environ.get("FEEDBACK_WEBHOOK_URL") or "").strip()
    secret = (os.environ.get("FEEDBACK_WEBHOOK_SECRET") or "").strip()
    if not url or not secret:
        return None
    return url, secret


def client_ip(headers, fallback="unknown"):
    if headers is not None:
        for name in ("x-forwarded-for", "x-real-ip"):
            raw = headers.get(name)
            if raw:
                first = raw.split(",")[0].strip()
                if first:
                    return first[:80]
    return (fallback or "unknown")[:80]


def rate_ok(ip, now=None):
    now = time.time() if now is None else now
    hits = [stamp for stamp in _HITS.get(ip, []) if now - stamp < WINDOW_S]
    _HITS[ip] = hits
    return len(hits) < MAX_PER_WINDOW


def remember(ip, now=None):
    now = time.time() if now is None else now
    hits = [stamp for stamp in _HITS.get(ip, []) if now - stamp < WINDOW_S]
    hits.append(now)
    _HITS[ip] = hits


def _trim_context(raw):
    if not isinstance(raw, dict):
        return None
    kept = {key: raw[key] for key in CONTEXT_KEYS if key in raw}
    blob = json.dumps(kept, ensure_ascii=False)
    if len(blob) > 8000:
        url = raw.get("url")
        return {"url": url[:500] if isinstance(url, str) else "", "trimmed": True}
    return kept


def validate(payload):
    if not isinstance(payload, dict):
        return None, "Poruka nije ispravna."
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        return None, "Napiši što nije u redu."
    message = message.strip()
    if len(message) > MAX_MESSAGE:
        return None, "Poruka je preduga."
    email = payload.get("email")
    if email in (None, ""):
        email = None
    elif not isinstance(email, str) or len(email.strip()) > 200 or not EMAIL_RE.match(email.strip()):
        return None, "E-pošta nije ispravna."
    else:
        email = email.strip()
    context = _trim_context(payload.get("context") or {})
    if context is None:
        return None, "Kontekst nije ispravan."
    page = payload.get("page")
    if not isinstance(page, str):
        page = ""
    page = page.strip()[:120]
    return {
        "message": message,
        "email": email,
        "context": context,
        "page": page or None,
    }, None


def _label(value, limit=300):
    if value is None or value == "":
        return ""
    if isinstance(value, dict):
        naziv = value.get("naziv") or value.get("name") or value.get("title")
        ident = value.get("id")
        if isinstance(naziv, str):
            naziv = naziv.strip()
        else:
            naziv = ""
        if ident is None:
            ident = ""
        else:
            ident = str(ident).strip()
        if naziv and ident:
            text = f"{naziv} ({ident})"
        else:
            text = naziv or ident
        return text[:limit]
    if isinstance(value, (str, int, float)):
        return str(value).strip()[:limit]
    return ""


def _viewport(value):
    if isinstance(value, dict):
        width, height = value.get("width"), value.get("height")
        if width not in (None, "") and height not in (None, ""):
            return f"{width}x{height}"[:80]
    if isinstance(value, str):
        return value.strip()[:80]
    return ""


def sheet_fields(row, user_agent, now=None):
    """Flatten a validated report into the Google Sheet columns."""
    context = row.get("context") or {}
    if now is None:
        stamp = datetime.now(ZAGREB)
    elif isinstance(now, datetime):
        stamp = now.astimezone(ZAGREB) if now.tzinfo else now.replace(tzinfo=ZAGREB)
    else:
        stamp = datetime.now(ZAGREB)
    return {
        "created_at": stamp.isoformat(timespec="seconds"),
        "message": row["message"],
        "email": row.get("email") or "",
        "page": row.get("page") or "",
        "sastavnica": _label(context.get("faculty")),
        "studij": _label(context.get("programme")),
        "course": _label(context.get("course")),
        "viewport": _viewport(context.get("viewport")),
        "user_agent": ((user_agent or "").strip()[:400] or ""),
        "context_json": json.dumps(context, ensure_ascii=False),
    }


def _webhook_ok(status, raw):
    if status is None or status >= 300:
        return False
    text = (raw or b"").decode("utf-8", "replace").strip()
    if not text:
        return 200 <= status < 300
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        # Apps Script may wrap JSON; a bare "ok" or HTML error is a miss.
        return False
    if isinstance(body, dict):
        return body.get("ok") is True
    return False


def post_row(row, url, secret, opener=None):
    payload = {"secret": secret}
    payload.update(row)
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
    )
    req.add_header("Content-Type", "application/json; charset=utf-8")
    open_ = opener or urllib.request.urlopen
    try:
        with open_(req, timeout=8) as resp:
            status = getattr(resp, "status", 200)
            raw = resp.read() if hasattr(resp, "read") else b""
            if _webhook_ok(status, raw):
                return status or 201, None
            return 502, "Pohrana je odbila zapis."
    except urllib.error.HTTPError as exc:
        try:
            raw = exc.read()
        except Exception:
            raw = b""
        if _webhook_ok(exc.code, raw):
            return exc.code, None
        return exc.code, "Pohrana je odbila zapis."
    except Exception:
        return 502, "Zapis nije stigao."


def accept(payload, ip, user_agent, now=None, opener=None):
    """Returns (status, body). Counts toward the rate limit only after a stored row."""
    creds = credentials()
    if not creds:
        return 503, {"ok": False, "stored": False, "error": "Pohrana prijava nije postavljena."}
    row, err = validate(payload)
    if err:
        return 400, {"ok": False, "stored": False, "error": err}
    clock = time.time() if not isinstance(now, (int, float)) else now
    if not rate_ok(ip, clock):
        return 429, {"ok": False, "stored": False, "error": "Previše prijava. Pokušaj kasnije."}
    url, secret = creds
    stamp = now if isinstance(now, datetime) else None
    fields = sheet_fields(row, user_agent, now=stamp)
    status, fault = post_row(fields, url, secret, opener)
    if fault or status >= 300:
        return 502, {"ok": False, "stored": False, "error": fault or "Zapis nije spremljen."}
    remember(ip, clock)
    return 201, {"ok": True, "stored": True}


class handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length < 0 or length > MAX_BODY:
            return self._send(400, {"ok": False, "stored": False, "error": "Poruka je prevelika."})
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._send(400, {"ok": False, "stored": False, "error": "Poruka nije ispravna."})
        ip = client_ip(self.headers, self.client_address[0] if self.client_address else "unknown")
        code, body = accept(payload, ip, self.headers.get("User-Agent"))
        self._send(code, body)

    def log_message(self, *args):
        return
