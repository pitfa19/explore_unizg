"""Regression verifiers through the public MCP call interface.

These fixtures model the published ISVU directory and course HTML. Network I/O
is replaced, not the public tool dispatcher or its parsing/search behavior.
"""
import json
import unittest
from datetime import date
from unittest.mock import patch

import _core

DIRECTORY = '''<table>
<tr><td><a href="/podaci/9996">Sveučilište u Zagrebu</a></td><td></td><td>Zagreb</td></tr>
<tr><td><a href="/podaci/37">Prirodoslovno-matematički fakultet-matematički odsjek</a></td><td>Sveučilište u Zagrebu</td><td>Zagreb</td></tr>
<tr><td><a href="/podaci/119">Prirodoslovno-matematički fakultet-prirodoslovni odsjeci</a></td><td>Sveučilište u Zagrebu</td><td>Zagreb</td></tr>
<tr><td><a href="/podaci/36">Fakultet elektrotehnike i računarstva</a></td><td>Sveučilište u Zagrebu</td><td>Zagreb</td></tr>
<tr><td><a href="/podaci/1003">Fakultet zdravstvenih studija</a></td><td>Sveučilište u Zagrebu</td><td>Zagreb</td></tr>
<tr><td><a href="/podaci/331">Hrvatsko katoličko sveučilište</a></td><td></td><td>Zagreb</td></tr>
</table>'''


def listing(code, title):
    return f'<table><tr><th>Naziv</th><th>Šifra</th></tr><tr><td>{title}</td><td>{code}</td></tr></table>'


def field(label, value):
    return f'<dt><span class="karticaDetaljno">{label}:</span></dt><dd>{value}</dd>'


class DiscoveryContractTest(unittest.TestCase):
    def setUp(self):
        self.paths = []
        self.patch = patch.object(_core.isvu, 'fetch', side_effect=self.fetch)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def fetch(self, path, **kwargs):
        self.paths.append(path)
        if path == '/pretrazivanje':
            return DIRECTORY
        if '/predmeti/predmet/' in path:
            return '<h2>Sample course</h2><dl>' + field('ECTS bodovi', '5.0') + field('Opis predmeta', 'Sample syllabus') + '</dl>'
        if '/podaci/9996/predmeti' in path:
            return listing('262687', 'Patenti u biotehnologiji')
        if '/podaci/37/predmeti' in path:
            return listing('33083', 'Kompleksna analiza')
        if '/podaci/119/predmeti' in path:
            return listing('36124', 'Matematička analiza 1')
        if '/podaci/36/predmeti' in path:
            return listing('222786', 'Strojno učenje 1')
        return listing('1', 'Other course')

    def call(self, name, arguments):
        response = _core.handle_rpc({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                                     'params': {'name': name, 'arguments': arguments}})
        self.assertIn('result', response)
        return json.loads(response['result']['content'][0]['text'])

    def test_institution_discovery_includes_root_and_current_children(self):
        result = self.call('unizg_institutions', {})
        ids = {row['id'] for row in result['institutions']}
        self.assertEqual(ids, {9996, 37, 119, 36, 1003})

    def test_global_search_finds_root_university_course(self):
        result = self.call('unizg_courses', {'query': 'Patenti u biotehnologiji', 'year': 2026})
        self.assertEqual([(c['faculty_id'], c['sifra']) for c in result['courses']], [(9996, '262687')])

    def test_plain_pmf_searches_both_divisions(self):
        result = self.call('unizg_courses', {'faculty': 'PMF', 'query': 'analiza', 'year': 2026})
        self.assertEqual({c['faculty_id'] for c in result['courses']}, {37, 119})

    def test_single_faculty_operation_does_not_guess_pmf_division(self):
        result = self.call('unizg_programmes', {'faculty': 'PMF', 'year': 2026})
        self.assertIn('error', result)
        self.assertIn('37', result['error'])
        self.assertIn('119', result['error'])

    def test_current_year_default_is_shared_with_client(self):
        with patch.object(_core.isvu, 'current_academic_year', return_value=2026, create=True):
            result = self.call('unizg_course', {'faculty_id': 36, 'code': '222786', 'enrich': False})
        self.assertNotIn('error', result)
        self.assertEqual(result['akademskaGodina'], 2026)
        self.assertIn('/podaci/36/akademskagodina/2026/predmeti/predmet/222786', self.paths)

    def test_partial_faculty_failure_is_reported_not_complete_empty(self):
        original = self.fetch
        def failing(path, **kwargs):
            if '/podaci/37/predmeti' in path:
                raise OSError('upstream unavailable')
            return original(path, **kwargs)
        with patch.object(_core.isvu, 'fetch', side_effect=failing):
            result = self.call('unizg_courses', {'faculty': 'PMF', 'query': 'analiza', 'year': 2026})
        self.assertEqual(result['coverage']['faculties_failed'], [37])
        self.assertFalse(result['coverage']['complete'])
        self.assertEqual({c['faculty_id'] for c in result['courses']}, {119})

    def test_new_tools_are_advertised(self):
        response = _core.handle_rpc({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'})
        names = {t['name'] for t in response['result']['tools']}
        self.assertTrue({'unizg_sources', 'unizg_discover'} <= names)

    def test_invalid_search_limit_is_rejected(self):
        result = self.call('unizg_courses', {'faculty': 'FER', 'limit': -1})
        self.assertIn('error', result)


class AcademicYearTest(unittest.TestCase):
    def test_october_rollover(self):
        self.assertEqual(_core.isvu.current_academic_year(date(2026, 9, 30)), 2025)
        self.assertEqual(_core.isvu.current_academic_year(date(2026, 10, 1)), 2026)
        self.assertEqual(_core.isvu.current_academic_year(date(2027, 1, 1)), 2026)


if __name__ == '__main__':
    unittest.main()
