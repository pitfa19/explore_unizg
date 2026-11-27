import json
import unittest
from unittest import mock

import feedback


class _Resp:
    def __init__(self, status, body=b'{"ok": true}'):
        self.status = status
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class FeedbackTest(unittest.TestCase):
    def setUp(self):
        feedback.reset_rates()

    def test_missing_env_is_503(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            code, body = feedback.accept({"message": "Graf prikazuje samo jednu godinu."}, "1.2.3.4", "ua")
        self.assertEqual(code, 503)
        self.assertFalse(body["stored"])

    def test_empty_message_and_bad_email(self):
        env = {
            "FEEDBACK_WEBHOOK_URL": "https://script.google.com/macros/s/example/exec",
            "FEEDBACK_WEBHOOK_SECRET": "secret",
        }
        with mock.patch.dict("os.environ", env, clear=True):
            code, body = feedback.accept({"message": "   "}, "1.2.3.4", "ua")
            self.assertEqual(code, 400)
            code, body = feedback.accept({"message": "Krivo", "email": "ne"}, "1.2.3.4", "ua")
            self.assertEqual(code, 400)
            self.assertIn("E-pošta", body["error"])

    def test_stores_trimmed_context_and_counts_the_ip(self):
        env = {
            "FEEDBACK_WEBHOOK_URL": "https://script.google.com/macros/s/example/exec",
            "FEEDBACK_WEBHOOK_SECRET": "secret",
        }
        seen = {}

        def opener(req, timeout):
            seen["url"] = req.full_url
            seen["body"] = json.loads(req.data.decode("utf-8"))
            return _Resp(200)

        payload = {
            "message": "  Semestar 4 nema Diplomski rad.  ",
            "email": " netko@example.com ",
            "page": "graph",
            "context": {
                "url": "https://explore-unizg.vercel.app/",
                "viewport": {"width": 390, "height": 844},
                "faculty": {"id": "3", "naziv": "FER"},
                "programme": {"id": "19", "naziv": "Računarstvo"},
                "course": {"id": "36:223060", "naziv": "Diplomski rad"},
                "password": "ne spremaj",
            },
        }
        with mock.patch.dict("os.environ", env, clear=True):
            code, body = feedback.accept(payload, "203.0.113.8", "TestAgent", now=1000, opener=opener)
            self.assertEqual(code, 201)
            self.assertTrue(body["stored"])
            first = dict(seen["body"])
            again = feedback.accept(
                {"message": "još jedna"}, "203.0.113.8", "TestAgent", now=1001, opener=opener,
            )
        seen["body"] = first
        self.assertEqual(seen["url"], "https://script.google.com/macros/s/example/exec")
        self.assertEqual(seen["body"]["secret"], "secret")
        self.assertEqual(seen["body"]["message"], "Semestar 4 nema Diplomski rad.")
        self.assertEqual(seen["body"]["email"], "netko@example.com")
        self.assertEqual(seen["body"]["page"], "graph")
        self.assertEqual(seen["body"]["sastavnica"], "FER (3)")
        self.assertEqual(seen["body"]["studij"], "Računarstvo (19)")
        self.assertEqual(seen["body"]["course"], "Diplomski rad (36:223060)")
        self.assertEqual(seen["body"]["viewport"], "390x844")
        self.assertEqual(seen["body"]["user_agent"], "TestAgent")
        context = json.loads(seen["body"]["context_json"])
        self.assertEqual(context["course"]["id"], "36:223060")
        self.assertNotIn("password", context)
        self.assertEqual(again[0], 201)

    def test_rate_limit_is_per_ip(self):
        env = {
            "FEEDBACK_WEBHOOK_URL": "https://script.google.com/macros/s/example/exec",
            "FEEDBACK_WEBHOOK_SECRET": "secret",
        }

        def opener(req, timeout):
            return _Resp(200)

        with mock.patch.dict("os.environ", env, clear=True):
            for i in range(feedback.MAX_PER_WINDOW):
                code, _ = feedback.accept({"message": f"prijava {i}"}, "198.51.100.4", "ua", now=5000 + i, opener=opener)
                self.assertEqual(code, 201)
            blocked, body = feedback.accept({"message": "šesta"}, "198.51.100.4", "ua", now=5005, opener=opener)
            other, _ = feedback.accept({"message": "druga adresa"}, "198.51.100.5", "ua", now=5005, opener=opener)
        self.assertEqual(blocked, 429)
        self.assertFalse(body["stored"])
        self.assertEqual(other, 201)

    def test_failed_store_does_not_consume_the_allowance(self):
        env = {
            "FEEDBACK_WEBHOOK_URL": "https://script.google.com/macros/s/example/exec",
            "FEEDBACK_WEBHOOK_SECRET": "secret",
        }

        def opener(req, timeout):
            raise urllib_error()

        with mock.patch.dict("os.environ", env, clear=True):
            code, body = feedback.accept({"message": "pad"}, "203.0.113.9", "ua", now=10, opener=opener)
            self.assertEqual(code, 502)
            self.assertFalse(body["stored"])
            self.assertTrue(feedback.rate_ok("203.0.113.9", now=11))

    def test_webhook_rejecting_ok_false_is_502(self):
        env = {
            "FEEDBACK_WEBHOOK_URL": "https://script.google.com/macros/s/example/exec",
            "FEEDBACK_WEBHOOK_SECRET": "secret",
        }

        def opener(req, timeout):
            return _Resp(200, b'{"ok": false, "error": "forbidden"}')

        with mock.patch.dict("os.environ", env, clear=True):
            code, body = feedback.accept({"message": "pad"}, "203.0.113.10", "ua", now=10, opener=opener)
        self.assertEqual(code, 502)
        self.assertFalse(body["stored"])


def urllib_error():
    import urllib.error
    raise urllib.error.URLError("down")


if __name__ == "__main__":
    unittest.main()
