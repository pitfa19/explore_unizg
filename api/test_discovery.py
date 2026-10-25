"""Independent public-contract tests for bounded syllabus discovery."""
import unittest

from _discovery import discover


class DiscoveryTest(unittest.TestCase):
    def run_search(self, args=None, lists=None, records=None):
        lists = lists if lists is not None else {1: [{"sifra": "A", "naziv": "Informacijski sustavi"}]}
        records = records if records is not None else {(1, "A"): {
            "naziv": "Informacijski sustavi", "opis": "Uvod u računalnu sigurnost.",
            "ishodi": ["Analizirati zaštitu podataka"], "ects": 5,
            "jezici": "hrvatski", "programmes": [{"semestar": 3, "status": "Obavezni"}],
            "source": "https://example.test/course/A"}}
        calls = []
        def course_list(fid, year):
            self.assertEqual(year, 2026)
            value = lists[fid]
            if isinstance(value, Exception):
                raise value
            return value
        def course_detail(fid, code, year):
            calls.append((fid, code))
            value = records[(fid, code)]
            if isinstance(value, Exception):
                raise value
            return value
        result = discover(args or {"query": "sigurnost"}, list(lists), 2026, course_list, course_detail)
        return result, calls

    def test_description_and_outcome_not_only_title(self):
        for query, field in [("sigurnost", "opis"), ("zastitu", "ishodi")]:
            out, _ = self.run_search({"query": query})
            self.assertEqual(out["count"], 1)
            course = out["courses"][0]
            self.assertEqual(course["akademskaGodina"], 2026)
            self.assertEqual(course["source"], "https://example.test/course/A")
            self.assertIn(field, [s["field"] for s in course["snippets"]])
            self.assertNotIn("opis", course)

    def test_croatian_fold_and_no_teacher_search(self):
        out, _ = self.run_search({"query": "racunalnu"})
        self.assertEqual(out["count"], 1)
        out, _ = self.run_search({"query": "Đuro"}, records={(1, "A"): {"nositelji": "Đuro", "opis": "Matematika"}})
        self.assertEqual(out["count"], 0)
        out, _ = self.run_search({"query": "uredjaji"}, records={(1, "A"): {"opis": "Uređaji i mjerenja"}})
        self.assertEqual(out["count"], 1)

    def test_adapter_learning_outcomes_are_searchable(self):
        out, _ = self.run_search({"query": "sigurnost"}, records={(1, "A"): {
            "ishodi_ucenja": ["Procijeniti sigurnost sustava"],
            "source_enrichment": {"status": "verified", "sources": ["https://example.test/faculty"]}}})
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["courses"][0]["snippets"][0]["field"], "ishodi_ucenja")
        self.assertEqual(out["courses"][0]["source_enrichment"]["status"], "verified")

    def test_adapter_syllabus_is_searchable(self):
        out, _ = self.run_search({"query": "rekurzija"}, records={(1, "A"): {
            "opis": "Osnove programiranja", "syllabus": "Funkcije, rekurzija i pokazivači"}})
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["courses"][0]["snippets"][0]["field"], "syllabus")

    def test_content_gaps_and_enrichment_warnings_survive_no_matches(self):
        warning = "Faculty HTML enrichment is unmapped or unsupported"
        record = {"source_warnings": [warning], "source_enrichment": {"status": "unknown"}}
        out, _ = self.run_search(records={(1, "A"): record})
        self.assertTrue(out["coverage"]["exhausted"])
        self.assertEqual(out["coverage"]["missing_content_values"], {"opis": 1, "ishodi": 1})
        self.assertEqual(out["coverage"]["incomplete_enrichment_count"], 1)
        self.assertEqual(out["source_warnings"][0]["warnings"], [warning])
        self.assertIn("bounded, not exhaustive", " ".join(out["warnings"]))
        self.assertTrue(out["coverage"]["incomplete_reason"])
        out, _ = self.run_search({"query": "informacijski"}, records={(1, "A"): record})
        self.assertEqual(out["courses"][0]["source_warnings"], [warning])

    def test_stop_fetching_exceptions_propagate_without_more_network(self):
        class RateLimited(RuntimeError):
            stop_fetching = True
        for stage in ("list", "detail"):
            with self.subTest(stage=stage):
                calls = []
                failure = RateLimited("429 retry later")
                def course_list(fid, year):
                    calls.append(("list", fid))
                    if stage == "list":
                        raise failure
                    return [{"sifra": "A", "naziv": "Test"}]
                def course_detail(fid, code, year):
                    calls.append(("detail", fid))
                    raise failure
                with self.assertRaises(RateLimited) as caught:
                    discover({"query": "a"}, [1, 2], 2026, course_list, course_detail)
                self.assertIs(caught.exception, failure)
                self.assertEqual(calls, [("list", 1)] if stage == "list" else
                                 [("list", 1), ("list", 2), ("detail", 1)])

    def test_round_robin_bound_and_deterministic_counts(self):
        lists = {1: [{"sifra": str(n), "naziv": "Analiza"} for n in range(4)],
                 9: [{"sifra": "Z", "naziv": "Analiza"}]}
        records = {(fid, row["sifra"]): {"opis": "Sigurnost"} for fid, rows in lists.items() for row in rows}
        out, calls = self.run_search({"query": "sigurnost", "max_courses": 2}, lists, records)
        self.assertEqual(calls, [(1, "0"), (9, "Z")])
        self.assertEqual(out["coverage"]["candidate_count"], 5)
        self.assertEqual(out["coverage"]["examined_count"], 2)
        self.assertFalse(out["coverage"]["exhausted"])
        self.assertIn("bounded, not exhaustive", " ".join(out["warnings"]))
        self.assertEqual(out, self.run_search({"query": "sigurnost", "max_courses": 2}, lists, records)[0])

    def test_result_limit_is_not_fetch_budget(self):
        lists = {1: [{"sifra": str(n), "naziv": "Analiza"} for n in range(3)]}
        records = {(1, str(n)): {"opis": "sigurnost"} for n in range(3)}
        out, calls = self.run_search({"query": "sigurnost", "limit": 1}, lists, records)
        self.assertEqual(len(calls), 3)
        self.assertEqual(out["total_matches"], 3)
        self.assertEqual(out["count"], 1)
        self.assertTrue(out["coverage"]["result_truncated"])
        self.assertTrue(out["coverage"]["exhausted"])

    def test_candidate_query_discloses_non_exhaustive_scope(self):
        out, calls = self.run_search({"query": "sigurnost", "candidate_query": "matematika"})
        self.assertEqual(calls, [])
        self.assertEqual(out["coverage"]["candidate_count"], 0)
        self.assertIn("bounded, not exhaustive", " ".join(out["warnings"]))

    def test_list_and_detail_failures_are_visible(self):
        out, _ = self.run_search(lists={1: RuntimeError("unavailable"), 2: [{"sifra": "B", "naziv": "Test"}]},
                                 records={(2, "B"): RuntimeError("timeout")})
        self.assertEqual(out["coverage"]["faculties_failed"], [1])
        self.assertEqual(out["coverage"]["failed_count"], 1)
        self.assertEqual(out["coverage"]["examined_count"], 1)
        self.assertEqual(len(out["failures"]), 2)
        self.assertTrue(out["coverage"]["incomplete_reason"])

    def test_error_record_is_failure(self):
        out, _ = self.run_search(records={(1, "A"): {"error": "missing course"}})
        self.assertEqual(out["coverage"]["failed_count"], 1)

    def test_unknown_language_is_counted_not_asserted_absent(self):
        out, _ = self.run_search({"query": "sigurnost", "language": "English"},
                                 records={(1, "A"): {"opis": "sigurnost", "jezici": None}})
        self.assertEqual(out["count"], 0)
        self.assertEqual(out["coverage"]["unknown_filter_values"]["language"], 1)
        self.assertIn("unknown", " ".join(out["warnings"]).lower())

    def test_programme_filters_must_cooccur(self):
        record = {"opis": "sigurnost", "programmes": [{"semestar": 3, "status": "Obavezni"},
                                                          {"semestar": 5, "status": "Izborni"}]}
        out, _ = self.run_search({"query": "sigurnost", "semester": 3, "status": "izborni"}, records={(1, "A"): record})
        self.assertEqual(out["count"], 0)
        out, _ = self.run_search({"query": "sigurnost", "semester": 5, "status": "izborni"}, records={(1, "A"): record})
        self.assertEqual(out["count"], 1)

    def test_ects_bounds_and_unknown(self):
        out, _ = self.run_search({"query": "sigurnost", "ects_min": 5, "ects_max": 5})
        self.assertEqual(out["count"], 1)
        out, _ = self.run_search({"query": "sigurnost", "ects_min": 6})
        self.assertEqual(out["count"], 0)
        out, _ = self.run_search({"query": "sigurnost", "ects_min": 1}, records={(1, "A"): {"opis": "sigurnost"}})
        self.assertEqual(out["coverage"]["unknown_filter_values"]["ects"], 1)

    def test_default_and_maximum_fetch_budgets(self):
        lists = {1: [{"sifra": str(n), "naziv": "Analiza"} for n in range(105)]}
        records = {(1, str(n)): {"opis": "sigurnost"} for n in range(105)}
        for args, expected in [({"query": "sigurnost"}, 30),
                               ({"query": "sigurnost", "max_courses": 100, "limit": 100}, 100)]:
            out, calls = self.run_search(args, lists, records)
            self.assertEqual(len(calls), expected)
            self.assertEqual(out["coverage"]["candidate_count"], 105)

    def test_partial_programme_unknown_and_duplicate_identity(self):
        out, _ = self.run_search({"query": "sigurnost", "semester": 3, "status": "izborni"},
                                 records={(1, "A"): {"opis": "sigurnost", "programmes": [{"semestar": 3}]}})
        self.assertEqual(out["coverage"]["unknown_filter_values"]["status"], 1)
        rows = [{"sifra": "A", "naziv": "Analiza"}] * 2
        out, calls = self.run_search(lists={1: rows})
        self.assertEqual(out["coverage"]["candidate_count"], 1)
        self.assertEqual(len(calls), 1)

    def test_snippets_preserve_unicode_and_stay_small(self):
        text = "Uvod " * 100 + "zaštita podataka" + " kraj" * 100
        out, _ = self.run_search({"query": "zastita"}, records={(1, "A"): {"opis": text}})
        snippet = out["courses"][0]["snippets"][0]["text"]
        self.assertIn("zaštita", snippet)
        self.assertLessEqual(len(snippet), 362)

    def test_validation_rejects_unrepresentable_numbers(self):
        def unexpected(*_):
            self.fail("Validation must not fetch")
        out = discover({"query": "a", "ects_max": 10 ** 400}, [1], 2026, unexpected, unexpected)
        self.assertIn("error", out)

    def test_validation_happens_before_network(self):
        invalid = [{}, {"query": " "}, {"query": 2}, {"query": "a", "max_courses": 101},
                   {"query": "a", "limit": 0}, {"query": "a", "semester": True},
                   {"query": "a", "semester": 1.5}, {"query": "a", "ects_min": -1},
                   {"query": "a", "ects_max": float("nan")}, {"query": "a", "ects_min": 6, "ects_max": 5},
                   {"query": "a", "status": "maybe"}, {"query": "a", "language": []},
                   {"query": "a", "candidate_query": 2}]
        def unexpected(*_):
            self.fail("Validation must not fetch")
        for args in invalid:
            with self.subTest(args=args):
                self.assertIn("error", discover(args, [1], 2026, unexpected, unexpected))


if __name__ == "__main__":
    unittest.main()
