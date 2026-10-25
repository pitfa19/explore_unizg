"""Public-function regressions using independently observed official HTML shapes."""
import copy
import json
from pathlib import Path
import unittest
from datetime import date
from unittest.mock import patch

from api._sources import enrich_course, sources_for

FIXTURES = Path(__file__).resolve().parents[1] / "tests/fixtures/sources"
FER = "https://www.fer.unizg.hr"


def fixture(name):
    return (FIXTURES / name).read_text()


def record(fid=16, code="214449", name="Programiranje 1", year=2026):
    return dict(faculty_id=fid, sifra=code, naziv=name, akademskaGodina=year,
                opis=None, preduvjeti_upis=[{"kolegij": "Existing formal requirement"}],
                preduvjeti_polaganje=[], source="https://www.isvu.hr/example")


class SourcesTests(unittest.TestCase):
    def fer_fetch(self, url):
        if url == FER + "/studiji/diplomski_studiji":
            return '<a href="/studiji/dipl/rac/zop">Znanost o podacima</a>'
        if url == FER + "/studiji/dipl/rac/zop":
            return fixture("fer-catalogue.html")
        if url == FER + "/predmet/struce1":
            return fixture("fer.html")
        return "<html></html>"

    def test_foi_description_outcomes_and_preservation(self):
        original = record()
        before = copy.deepcopy(original)
        calls = []
        def fetch(url):
            calls.append(url)
            return fixture("foi.html")
        result = enrich_course(original, fetch)
        self.assertEqual(original, before)
        self.assertIn("algoritamski", result["opis"])
        self.assertEqual(len(result["ishodi_ucenja"]), 2)
        self.assertEqual(result["preduvjeti_upis"], before["preduvjeti_upis"])
        self.assertEqual(result["prerequisite_statement"]["status"], "explicit_none")
        self.assertEqual(calls, ["https://nastava.foi.hr/course/214449/2026-2027"])
        self.assertEqual(result["source_enrichment"]["status"], "verified")
        json.dumps(result)

    def test_existing_description_not_overwritten(self):
        r = record()
        r["opis"] = "Original ISVU description"
        self.assertEqual(enrich_course(r, lambda _: fixture("foi.html"))["opis"], r["opis"])

    def test_fer_discovered_not_hardcoded_and_background_separate(self):
        r = record(36, "222786", "Strojno učenje 1")
        result = enrich_course(r, self.fer_fetch)
        self.assertEqual(len(result["ishodi_ucenja"]), 2)
        self.assertIn("Pythonu", result["recommended_background"])
        self.assertEqual(result["preduvjeti_upis"], r["preduvjeti_upis"])
        self.assertNotIn("prerequisite_statement", result)

    def test_second_fer_course_uses_catalogue_not_special_case(self):
        def fetch(url):
            return self.fer_fetch(url.replace("/predmet/novi", "/predmet/struce1")).replace(
                "struce1", "novi").replace("222786", "123456").replace("Strojno učenje 1", "Drugi predmet")
        result = enrich_course(record(36, "123456", "Drugi predmet"), fetch)
        self.assertEqual(result["source_enrichment"]["status"], "verified")

    def test_same_name_wrong_code_rejected(self):
        def fetch(url):
            return self.fer_fetch(url).replace("222786", "999999")
        result = enrich_course(record(36, "222786", "Strojno učenje 1"), fetch)
        self.assertIsNone(result["opis"])
        self.assertNotIn("ishodi_ucenja", result)
        self.assertTrue(result["source_warnings"])

    def test_foi_wrong_title_rejected(self):
        result = enrich_course(record(), lambda _: fixture("foi.html").replace("Programiranje 1", "Drugi kolegij"))
        self.assertIsNone(result["opis"])
        self.assertTrue(result["source_warnings"])

    def test_year_mismatch_rejected(self):
        for fid, code, name, fetch in [(16, "214449", "Programiranje 1", lambda _: fixture("foi.html")),
                                        (36, "222786", "Strojno učenje 1", self.fer_fetch)]:
            with self.subTest(fid=fid):
                result = enrich_course(record(fid, code, name, 2025), fetch)
                self.assertIsNone(result["opis"])
                self.assertTrue(any("year" in w.lower() for w in result["source_warnings"]))

    def test_unrelated_selected_year_does_not_validate_fer(self):
        def fetch(url):
            text = self.fer_fetch(url)
            if url.endswith("/predmet/struce1"):
                text = text.replace('value="2026" selected="selected"', 'value="2025" selected="selected"')
                text += '<select><option selected value="2026">Unrelated filter</option></select>'
            return text
        result = enrich_course(record(36, "222786", "Strojno učenje 1"), fetch)
        self.assertEqual(result["source_enrichment"]["status"], "unknown")

    def test_fetch_failure_preserves_original(self):
        def fail(_):
            raise OSError("offline")
        r = record()
        result = enrich_course(r, fail)
        for k, v in r.items():
            self.assertEqual(result[k], v)
        self.assertEqual(result["source_enrichment"]["status"], "unknown")
        self.assertTrue(result["source_warnings"])

    def test_unknown_faculty_not_absence(self):
        result = enrich_course(record(999999), lambda _: self.fail("must not fetch"))
        self.assertEqual(result["source_enrichment"]["status"], "unknown")
        self.assertEqual(sources_for(999999)["status"], "unknown")
        self.assertEqual(sources_for(999999)["sources"], [])

    def test_missing_sections_remain_unknown(self):
        html = '<div class="text-h6">Programiranje 1</div><div class="text-subtitle-1">2026/2027</div>'
        result = enrich_course(record(), lambda _: html)
        self.assertNotIn("prerequisite_statement", result)
        self.assertNotIn("ishodi_ucenja", result)
        self.assertTrue(any("unknown" in w for w in result["source_warnings"]))

    def test_foi_historical_year_uses_explicit_route(self):
        calls = []
        def fetch(url):
            calls.append(url)
            return fixture("foi.html").replace("2026/2027", "2024/2025")
        result = enrich_course(record(year=2024), fetch)
        self.assertEqual(result["source_enrichment"]["status"], "verified")
        self.assertEqual(calls, ["https://nastava.foi.hr/course/214449/2024-2025"])

    def test_fer_non_background_text_not_reclassified_as_recommendation(self):
        def fetch(url):
            text = self.fer_fetch(url)
            start = text.find('Minimalna potrebna predznanja:')
            end = text.find('</div>', start)
            return text[:start] + 'Položen predmet Uvod u programiranje.' + text[end:] if start >= 0 else text
        r = record(36, "222786", "Strojno učenje 1")
        result = enrich_course(r, fetch)
        self.assertNotIn("recommended_background", result)
        self.assertEqual(result["prerequisite_statement"]["status"], "published_text")
        self.assertEqual(result["preduvjeti_upis"], r["preduvjeti_upis"])

    def test_conflicting_prerequisite_evidence_preserved_and_flagged(self):
        result = enrich_course(record(), lambda _: fixture("foi.html"))
        self.assertTrue(result["preduvjeti_upis"])
        self.assertEqual(result["prerequisite_statement"]["status"], "explicit_none")
        self.assertTrue(any("both sources" in w for w in result["source_warnings"]))

    def test_catalogue_off_domain_links_never_fetched(self):
        calls = []
        def fetch(url):
            calls.append(url)
            return '<a href="https://evil.example/predmet/struce1">Strojno učenje 1</a>'
        result = enrich_course(record(36, "222786", "Strojno učenje 1"), fetch)
        self.assertTrue(all(url.startswith(FER + "/") for url in calls))
        self.assertEqual(result["source_enrichment"]["status"], "unknown")

    def test_kind_filter_exposes_unmapped_institutions(self):
        calendars = sources_for(kind="calendar")
        self.assertIn(36, calendars["unmapped_faculty_ids"])
        self.assertNotIn(9996, calendars["unmapped_faculty_ids"])
        self.assertEqual(sources_for(36, "calendar")["status"], "unknown")

    def test_directory_mutation_does_not_leak(self):
        first = sources_for(36)
        first["sources"][0]["faculty_ids"].append(99999)
        self.assertEqual(sources_for(99999)["sources"], [])

    def test_top_level_sources_append_preserve_and_copy(self):
        r = record()
        r["sources"] = [{"url": "https://www.isvu.hr/example", "kind": "isvu"}]
        before = copy.deepcopy(r)
        result = enrich_course(r, lambda _: fixture("foi.html"))
        self.assertEqual(result["sources"][0], r["sources"][0])
        self.assertEqual(result["sources"][-1]["url"], "https://nastava.foi.hr/course/214449/2026-2027")
        self.assertEqual(len(result["sources"]), 2)
        self.assertEqual(r, before)
        result["sources"][0]["kind"] = "changed"
        self.assertEqual(r, before)

    def test_fer_croatian_background_alias(self):
        result = enrich_course(record(36, "222786", "Strojno učenje 1"), self.fer_fetch)
        self.assertIsInstance(result["preporuceno_predznanje"], str)
        self.assertEqual(result["preporuceno_predznanje"], result["recommended_background"])

    def test_description_source_only_when_filled(self):
        r = record()
        result = enrich_course(r, lambda _: fixture("foi.html"))
        self.assertEqual(result["opis_source"], "https://nastava.foi.hr/course/214449/2026-2027")
        r["opis"] = "Existing ISVU text"
        r["opis_source"] = r["source"]
        result = enrich_course(r, lambda _: fixture("foi.html"))
        self.assertEqual(result["opis_source"], r["source"])

    def test_enrichment_checked_date_is_runtime(self):
        with patch("api._sources.date", create=True) as clock:
            clock.today.return_value = date(2031, 2, 3)
            result = enrich_course(record(), lambda _: fixture("foi.html"))
        self.assertEqual(result["source_enrichment"]["sources"][0]["checked_date"], "2031-02-03")

    def test_preserve_existing_warnings_success_and_failure(self):
        r = record()
        r["source_warnings"] = ["Existing source warning"]
        for fetch in (lambda _: fixture("foi.html"), lambda _: "unmatched HTML"):
            result = enrich_course(r, fetch)
            self.assertEqual(result["source_warnings"][0], "Existing source warning")
            self.assertEqual(r["source_warnings"], ["Existing source warning"])

    def test_stop_fetching_propagates_without_more_requests(self):
        class StopFetching(RuntimeError):
            stop_fetching = True
        for fid, code, name, stage in [(16, "214449", "Programiranje 1", "first"),
                                       (36, "222786", "Strojno učenje 1", "first"),
                                       (36, "222786", "Strojno učenje 1", "course")]:
            calls = []
            halted = StopFetching("HTTP429")
            def fetch(url):
                calls.append(url)
                if stage == "first" or "/predmet/" in url:
                    raise halted
                return self.fer_fetch(url)
            with self.subTest(fid=fid, stage=stage):
                with self.assertRaises(StopFetching) as raised:
                    enrich_course(record(fid, code, name), fetch)
                self.assertIs(raised.exception, halted)
                if stage == "first":
                    self.assertEqual(len(calls), 1)
                else:
                    self.assertTrue(calls[-1].endswith("/predmet/struce1"))

    def test_source_directory_honest_metadata_and_filters(self):
        directory = sources_for()
        json.dumps(directory)
        for fid in (36, 16, 37, 119, 58, 66, 117, 9996):
            self.assertTrue(sources_for(fid)["sources"], fid)
        self.assertEqual(sources_for(54)["status"], "unknown")
        for source in directory["sources"]:
            for key in ("url", "kind", "status", "coverage", "academic_year_handling", "checked_date"):
                self.assertIn(key, source)
        law = sources_for(66)["sources"][0]
        self.assertEqual(law["retrieval"], "directory_only")
        self.assertFalse(law["pdf_text_extraction"])
        self.assertTrue(all(s["kind"] == "calendar" for s in sources_for(kind="calendar")["sources"]))


if __name__ == "__main__":
    unittest.main()
