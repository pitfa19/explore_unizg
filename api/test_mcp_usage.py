import io
import json
import unittest
from contextlib import redirect_stdout

import mcp


SECRET = "SECRET-QUERY-SHOULD-NOT-LEAK"
ADDRESS = "203.0.113.8"


class McpUsageTest(unittest.TestCase):
    def setUp(self):
        mcp.reset_usage_client()

    def lines(self, fn):
        buf = io.StringIO()
        with redirect_stdout(buf):
            fn()
        return [json.loads(line) for line in buf.getvalue().splitlines() if line.strip()]

    def test_initialize_then_tool_call_is_anonymous(self):
        captured = {}

        def run():
            captured["init"] = mcp.observe({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "clientInfo": {"name": "Claude Desktop", "version": "1.2.3"},
                },
            })
            captured["call"] = mcp.observe({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "not-a-tool",
                    "arguments": {"query": SECRET, "faculty_id": 36, "ip": ADDRESS},
                },
            })

        rows = self.lines(run)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["event"], "mcp_call")
        self.assertEqual(rows[0]["method"], "initialize")
        self.assertIsNone(rows[0]["tool"])
        self.assertEqual(rows[0]["client"], "Claude Desktop")
        self.assertTrue(rows[0]["ok"])
        self.assertIsInstance(rows[0]["ms"], int)
        self.assertEqual(set(rows[0]), {"event", "method", "tool", "client", "ok", "ms"})
        self.assertEqual(rows[1]["method"], "tools/call")
        self.assertEqual(rows[1]["tool"], "not-a-tool")
        self.assertEqual(rows[1]["client"], "Claude Desktop")
        self.assertFalse(rows[1]["ok"])
        blob = json.dumps(rows)
        self.assertNotIn(SECRET, blob)
        self.assertNotIn(ADDRESS, blob)
        self.assertNotIn("1.2.3", blob)
        self.assertNotIn("arguments", blob)
        self.assertIn("serverInfo", captured["init"]["result"])
        self.assertTrue(captured["call"]["result"]["isError"])

    def test_unknown_method_is_not_ok(self):
        rows = self.lines(lambda: mcp.observe({
            "jsonrpc": "2.0", "id": 3, "method": "nope",
        }))
        self.assertEqual(rows[0]["method"], "nope")
        self.assertFalse(rows[0]["ok"])
        self.assertIsNone(rows[0]["client"])

    def test_notification_is_ok_and_returns_nothing(self):
        captured = {}

        def run():
            captured["res"] = mcp.observe({
                "jsonrpc": "2.0", "method": "notifications/initialized",
            })

        rows = self.lines(run)
        self.assertIsNone(captured["res"])
        self.assertEqual(rows[0]["method"], "notifications/initialized")
        self.assertTrue(rows[0]["ok"])

    def test_invalid_message_is_not_ok(self):
        rows = self.lines(lambda: mcp.observe(["not", "a", "call"]))
        self.assertIsNone(rows[0]["method"])
        self.assertFalse(rows[0]["ok"])

    def test_client_name_keeps_no_newlines(self):
        rows = self.lines(lambda: mcp.observe({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "initialize",
            "params": {"clientInfo": {"name": "Cursor\n203.0.113.9"}},
        }))
        self.assertEqual(rows[0]["client"], "Cursor 203.0.113.9")
        self.assertNotIn("\n", json.dumps(rows[0]))
