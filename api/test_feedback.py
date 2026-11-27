import json
import unittest
from unittest import mock

import feedback


class _Resp:
    def __init__(self, status):
        self.status = status

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
        env = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret"}
        with mock.patch.dict("os.environ", env, clear=True):
            code, body = feedback.accept({"message": "   "}, "1.2.3.4", "ua")
            self.assertEqual(code, 400)
            code, body = feedback.accept({"message": "Krivo", "email": "ne"}, "1.2.3.4", "ua")
            self.assertEqual(code, 400)
            self.assertIn("E-pošta", body["error"])

    def test_stores_trimmed_context_and_counts_the_ip(self):
        env = {"SUPABASE_URL": "https://example.supabase.co/", "SUPABASE_SERVICE_ROLE_KEY": "secret"}
        seen = {}

        def opener(req, timeout):
            seen["url"] = req.full_url
            seen["auth"] = req.get_header("Authorization")
            seen["body"] = json.loads(req.data.decode("utf-8"))
            return _Resp(201)

        payload = {
            "message": "  Semestar 4 nema Diplomski rad.  ",
            "email": " netko@example.com ",
            "page": "graph",
            "context": {
                "url": "https://explore-unizg.vercel.app/",
                "course": {"id": "36:223060"},
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
        self.assertEqual(seen["url"], "https://example.supabase.co/rest/v1/feedback")
        self.assertEqual(seen["auth"], "Bearer secret")
        self.assertEqual(seen["body"]["message"], "Semestar 4 nema Diplomski rad.")
        self.assertEqual(seen["body"]["email"], "netko@example.com")
        self.assertEqual(seen["body"]["context"]["course"]["id"], "36:223060")
        self.assertNotIn("password", seen["body"]["context"])
        self.assertEqual(seen["body"]["user_agent"], "TestAgent")
        self.assertEqual(again[0], 201)

    def test_rate_limit_is_per_ip(self):
        env = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret"}

        def opener(req, timeout):
            return _Resp(201)

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
        env = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret"}

        def opener(req, timeout):
            raise urllib_error()

        with mock.patch.dict("os.environ", env, clear=True):
            code, body = feedback.accept({"message": "pad"}, "203.0.113.9", "ua", now=10, opener=opener)
            self.assertEqual(code, 502)
            self.assertFalse(body["stored"])
            self.assertTrue(feedback.rate_ok("203.0.113.9", now=11))


def urllib_error():
    import urllib.error
    raise urllib.error.URLError("down")


if __name__ == "__main__":
    unittest.main()
