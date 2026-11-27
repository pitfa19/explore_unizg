import unittest
from unittest import mock

import _core
import catalog


class CatalogShapeTest(unittest.TestCase):
    def test_fold_search_ignores_diacritics_and_faculty(self):
        courses = [
            {"faculty_id": 36, "sifra": "1", "naziv": "Računarstvo"},
            {"faculty_id": 119, "sifra": "2", "naziv": "Računarstvo"},
            {"faculty_id": 36, "sifra": "3", "naziv": "Fizika"},
        ]
        hits, total = catalog.filter_courses(courses, "racunarstvo", 36, 40)
        self.assertEqual(total, 1)
        self.assertEqual(hits[0]["sifra"], "1")

    def test_placement_picks_earliest_semester(self):
        season, godina, status, note = catalog.placement([
            {"semestar": 4, "status": "Izborni"},
            {"semestar": 3, "status": "Obavezni"},
        ])
        self.assertEqual((season, godina, status), ("zimski", 2, "obavezni"))
        self.assertIn("najraniji", note)

    def test_placement_missing_programme(self):
        season, godina, status, note = catalog.placement([])
        self.assertEqual((season, godina, status), ("zimski", 1, "obavezni"))
        self.assertIn("nije vratio", note)

    def test_shape_course_strips_teachers_and_keeps_prereqs(self):
        record = {
            "faculty_id": 36,
            "sifra": "33083",
            "naziv": "Računarstvo",
            "ects": 5,
            "nositelji": "ne smije izaći",
            "izvodaci": "ni ovo",
            "preduvjeti_upis": [{"kolegij": "Matematika 1", "uvjet": "položen"}],
            "programmes": [{"semestar": 2, "status": "Obavezni"}],
            "akademskaGodina": 2026,
            "source": "https://www.isvu.hr/example",
        }
        shaped = catalog.shape_course(record, {"id": 36, "naziv": "FER", "kratko": "FER"})
        self.assertEqual(shaped["id"], "36:33083")
        self.assertEqual(shaped["semestar"], "ljetni")
        self.assertEqual(shaped["godina"], 1)
        self.assertEqual(shaped["preduvjeti"][0]["uvjet"], "polozen")
        self.assertNotIn("nositelji", shaped)
        self.assertNotIn("izvodaci", shaped)

    def test_stamp_programme_adds_identity(self):
        stamped = catalog.stamp_programme({
            "kolegiji": [{
                "naziv": "Fizika",
                "sifra": "10",
                "semestar": "zimski",
                "godina": 1,
                "status": "obavezni",
                "ects": 6,
                "preduvjeti": [{"kolegij": "Matematika", "uvjet": "odslušan"}],
            }],
            "how_to_use": "agent text",
        }, {"id": 119, "kratko": "PMF"})
        course = stamped["kolegiji"][0]
        self.assertEqual(course["id"], "119:10")
        self.assertEqual(course["fakultet"], "PMF")
        self.assertEqual(course["izvor_preduvjeti"][0]["uvjet"], "odslusan")
        self.assertNotIn("_paths", course)

    def test_build_spine_reuses_course_lists(self):
        institutions = [
            {"id": 36, "naziv": "Fakultet elektrotehnike i računarstva", "grad": "Zagreb"},
            {"id": 16, "naziv": "Fakultet organizacije i informatike", "grad": "Varaždin"},
        ]
        lists = {
            36: [{"sifra": "1", "naziv": "Računarstvo"}],
            16: [{"sifra": "", "naziv": "prazno"}, {"sifra": "9", "naziv": "Baze podataka"}],
        }
        with mock.patch.object(_core, "_institutions", return_value=institutions), \
             mock.patch.object(catalog.isvu, "fetch_all", return_value={}) as fetch_all, \
             mock.patch.object(catalog.isvu, "course_list", side_effect=lambda fid, year: lists[fid]):
            spine = catalog.build_spine(2026)
        fetch_all.assert_called_once()
        self.assertEqual(spine["count"], 2)
        self.assertEqual(spine["institutions"][0]["kratko"], "FER")
        self.assertTrue(spine["coverage"]["complete"])
        self.assertEqual({c["sifra"] for c in spine["courses"]}, {"1", "9"})

    def test_search_one_faculty_does_not_require_full_spine(self):
        catalog._SPINE_MEM.clear()
        with mock.patch.object(catalog, "peek_spine", return_value=None), \
             mock.patch.object(catalog, "_read_faculty_courses", return_value=[
                 {"faculty_id": 36, "sifra": "1", "naziv": "Računarstvo"},
                 {"faculty_id": 36, "sifra": "2", "naziv": "Fizika"},
             ]) as read, \
             mock.patch.object(catalog, "load_spine") as load_spine:
            out = catalog.search({"q": "racun", "faculty_id": "36", "year": "2026"})
        load_spine.assert_not_called()
        read.assert_called_once()
        self.assertEqual(out["total_matches"], 1)
        self.assertEqual(out["courses"][0]["naziv"], "Računarstvo")
        self.assertEqual(out["from"], "faculty")

    def test_search_requires_two_letters(self):
        out = catalog.search({"q": "a"})
        self.assertIn("error", out)

    def test_mcp_tools_list_still_answers(self):
        res = _core.handle_rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        names = [tool["name"] for tool in res["result"]["tools"]]
        self.assertIn("unizg_courses", names)
        self.assertIn("unizg_dag_json", names)
        self.assertNotIn("error", res)


if __name__ == "__main__":
    unittest.main()
