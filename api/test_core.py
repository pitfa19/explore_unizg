import unittest

import _core


class FlattenProgrammesTest(unittest.TestCase):
    def test_inherits_non_curriculum_parent_as_category(self):
        studies = [
            {
                "sifraSmjera": 90,
                "nazivSmjera": "Dvopredmetni prijediplomski studiji",
                "nazivTipaSmjera": "Studij",
                "imaNastavniProgram": 0,
                "listaPodredjenihStudija": [
                    {
                        "sifraSmjera": 101,
                        "nazivSmjera": "Anglistika",
                        "nazivTipaSmjera": "Studij",
                        "imaNastavniProgram": 1,
                        "listaPodredjenihStudija": [],
                    }
                ],
            }
        ]

        result = _core._flatten(studies, [])

        self.assertEqual(result[0]["kategorija"], "Dvopredmetni prijediplomski studiji")
        self.assertEqual(result[1]["kategorija"], "Dvopredmetni prijediplomski studiji")

    def test_standalone_programme_has_no_invented_category(self):
        studies = [
            {
                "sifraSmjera": 1,
                "nazivSmjera": "Samostalni studij",
                "nazivTipaSmjera": "Studij",
                "imaNastavniProgram": 1,
                "listaPodredjenihStudija": [],
            }
        ]

        result = _core._flatten(studies, [])

        self.assertIsNone(result[0]["kategorija"])


if __name__ == "__main__":
    unittest.main()
