"""POST /api/feedback. A visitor report, stored in Supabase when the env vars exist.

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read from the environment.
They are never written to the repository. Missing either one returns 503.
"""
import json
import os
import re
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

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


def reset_rates():
    _HITS.clear()


def credentials():
    url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        return None
    return url, key


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


def post_row(row, url, key, opener=None):
    req = urllib.request.Request(
        url + "/rest/v1/feedback",
        data=json.dumps(row, ensure_ascii=False).encode("utf-8"),
        method="POST",
    )
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    open_ = opener or urllib.request.urlopen
    try:
        with open_(req, timeout=8) as resp:
            return getattr(resp, "status", 201), None
    except urllib.error.HTTPError as exc:
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
    now = time.time() if now is None else now
    if not rate_ok(ip, now):
        return 429, {"ok": False, "stored": False, "error": "Previše prijava. Pokušaj kasnije."}
    url, key = creds
    row["user_agent"] = ((user_agent or "").strip()[:400] or None)
    status, fault = post_row(row, url, key, opener)
    if fault or status >= 300:
        return 502, {"ok": False, "stored": False, "error": fault or "Zapis nije spremljen."}
    remember(ip, now)
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
