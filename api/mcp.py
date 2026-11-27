"""Remote MCP endpoint (Streamable HTTP) for the UNIZG course catalog.

Deployed as a Vercel Python function, so it ships with the website: POST JSON-RPC to
/api/mcp. Remote HTTP is what the Claude web and mobile apps need; the local stdio
variant lives in mcp/stdio_server.py.
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler

# Vercel puts the deployment root (/var/task) on sys.path, not the function's own directory,
# so a bare `import _core` fails there while working anywhere that runs this from api/. Add
# our own directory rather than relying on the caller's sys.path.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _core import handle_rpc  # noqa: E402  (needs the path above)

INFO = {
    "name": "unizg-courses",
    "transport": "streamable-http",
    "endpoint": "/api/mcp",
    "usage": "POST JSON-RPC 2.0. Add this URL as a custom connector in the Claude app.",
    "scope": "UNIZG course catalog: courses, curricula, literature, prerequisites. Not a people directory.",
}

# Name from the latest initialize on this instance. Not a person, and not stored anywhere else.
_client_name = None


def reset_usage_client():
    global _client_name
    _client_name = None


def _label(value, limit=80):
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())[:limit]
    return text or None


def note_client(params):
    """Remember clientInfo.name from an initialize message. Nothing else is kept."""
    global _client_name
    if not isinstance(params, dict):
        return _client_name
    info = params.get("clientInfo")
    if isinstance(info, dict):
        name = _label(info.get("name"))
        if name:
            _client_name = name
    return _client_name


def usage_line(method, tool, client, ok, ms, stream=None):
    """One anonymous count. Never includes arguments, addresses, or identifiers."""
    record = {
        "event": "mcp_call",
        "method": _label(method, 64) if isinstance(method, str) else None,
        "tool": _label(tool, 64) if isinstance(tool, str) else None,
        "client": _label(client) if isinstance(client, str) else None,
        "ok": bool(ok),
        "ms": max(0, int(ms)),
    }
    print(json.dumps(record, ensure_ascii=False, separators=(",", ":")), file=stream or sys.stdout, flush=True)
    return record


def describe(msg, response):
    method = msg.get("method") if isinstance(msg, dict) else None
    params = msg.get("params") if isinstance(msg, dict) and isinstance(msg.get("params"), dict) else {}
    tool = None
    if method == "tools/call":
        tool = _label(params.get("name"), 64)
    if method == "initialize":
        client = note_client(params)
    else:
        client = _client_name
    ok = True
    if not isinstance(response, dict):
        ok = response is None and method in ("notifications/initialized", "notifications/cancelled")
    elif "error" in response:
        ok = False
    else:
        result = response.get("result")
        if isinstance(result, dict) and result.get("isError") is True:
            ok = False
    return method if isinstance(method, str) else None, tool, client, ok


def observe(msg):
    """Handle one JSON-RPC message and log the count. Returns the response, or None."""
    started = time.perf_counter()
    if not isinstance(msg, dict):
        usage_line(None, None, _client_name, False, (time.perf_counter() - started) * 1000)
        return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid request"}}
    try:
        response = handle_rpc(msg)
    except Exception:
        usage_line(msg.get("method") if isinstance(msg.get("method"), str) else None,
                   None, _client_name, False, (time.perf_counter() - started) * 1000)
        raise
    method, tool, client, ok = describe(msg, response)
    usage_line(method, tool, client, ok, (time.perf_counter() - started) * 1000)
    return response


class handler(BaseHTTPRequestHandler):
    def _wants_sse(self):
        return "text/event-stream" in (self.headers.get("Accept") or "")

    def _send(self, code, payload, ctype="application/json"):
        body = (payload if isinstance(payload, (bytes, bytearray))
                else json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Authorization")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _send_rpc(self, payload):
        """Answer in whichever framing the client asked for.

        Streamable HTTP allows a JSON-RPC response to come back as one JSON object or as an
        SSE stream, and the client states its preference in Accept. Clients that ask for
        text/event-stream and get application/json can sit there waiting for a stream that
        never arrives, which looks exactly like the server not responding.
        """
        if not self._wants_sse():
            return self._send(200, payload)
        data = json.dumps(payload, ensure_ascii=False)
        self._send(200, f"event: message\ndata: {data}\n\n".encode("utf-8"),
                   ctype="text/event-stream")

    def _timed(self, method, ok):
        # do_GET and do_OPTIONS call this after the work, with a start time on the instance.
        elapsed = (time.perf_counter() - getattr(self, "_started", time.perf_counter())) * 1000
        usage_line(method, None, _client_name, ok, elapsed)

    def do_OPTIONS(self):
        self._started = time.perf_counter()
        self._send(204, b"")
        self._timed("OPTIONS", True)

    def do_GET(self):
        # GET is for opening a server-initiated stream, which this server does not do: it is
        # stateless and only ever answers a POST. Say so properly instead of handing back an
        # unrelated 200, which a client would try to parse as a stream.
        self._started = time.perf_counter()
        if self._wants_sse():
            self.send_response(405)
            self.send_header("Allow", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", "0")
            self.end_headers()
            self._timed("GET", False)
            return
        self._send(200, INFO)
        self._timed("GET", True)

    def do_POST(self):
        started = time.perf_counter()
        try:
            n = int(self.headers.get("Content-Length") or 0)
            msg = json.loads(self.rfile.read(n) or b"{}")
        except (ValueError, TypeError) as e:
            usage_line(None, None, _client_name, False, (time.perf_counter() - started) * 1000)
            return self._send(400, {"jsonrpc": "2.0", "id": None,
                                    "error": {"code": -32700, "message": f"Parse error: {e}"}})
        # A client may batch several calls in one array. Each call is its own count.
        if isinstance(msg, list):
            out = [r for r in (observe(m) for m in msg) if r is not None]
            return self._send_rpc(out) if out else self._send(202, b"")
        res = observe(msg)
        if res is None:                      # notification, nothing to return
            return self._send(202, b"")
        return self._send_rpc(res)

    def log_message(self, *a):               # keep Vercel logs quiet
        pass
