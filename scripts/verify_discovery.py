#!/usr/bin/env python3
"""Public HTTP acceptance checks. No dependency on server implementation internals.

Run against a local server, preview deployment, or production:
  python3 scripts/verify_discovery.py --endpoint http://127.0.0.1:8901/api/mcp
These are targeted read-only live requests, not a full catalog crawl.
"""
import argparse
from datetime import date
import json
import sys
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint', required=True)
    parser.add_argument('--year', type=int)
    parser.add_argument('--only', help='Comma-separated check names')
    args = parser.parse_args()
    today = date.today()
    year = args.year or (today.year if today.month >= 10 else today.year - 1)
    checks = []
    sequence = 0

    def rpc(method, params):
        nonlocal sequence
        sequence += 1
        request = urllib.request.Request(args.endpoint,
            data=json.dumps({'jsonrpc': '2.0', 'id': sequence, 'method': method, 'params': params}).encode(),
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
        with urllib.request.urlopen(request, timeout=240) as response:
            payload = json.load(response)
        if 'error' in payload:
            raise AssertionError(payload['error'])
        return payload['result']

    def call(name, **arguments):
        result = rpc('tools/call', {'name': name, 'arguments': arguments})
        record = json.loads(result['content'][0]['text'])
        if result.get('isError') or record.get('error'):
            raise AssertionError(record)
        return record

    def check(name, description):
        def register(fn):
            checks.append((name, description, fn))
            return fn
        return register

    @check('tools', 'Published connector advertises source and content discovery')
    def tools():
        names = {t['name'] for t in rpc('tools/list', {})['tools']}
        assert {'unizg_sources', 'unizg_discover'} <= names, sorted(names)
        return {'tools': len(names)}

    @check('institutions', 'Institution discovery includes the central university and both PMF divisions')
    def institutions():
        data = call('unizg_institutions')
        ids = {i['id'] for i in data['institutions']}
        assert {9996, 37, 119} <= ids, sorted(ids)
        return {'institutions': len(ids)}

    @check('central', 'University-wide exact-title search finds the central university patent course')
    def central():
        data = call('unizg_courses', query='Patenti u biotehnologiji', year=year)
        assert any(c['faculty_id'] == 9996 and c['sifra'] == '262687' for c in data['courses']), data
        assert data['coverage']['complete'], data['coverage']
        return {'matches': data['count']}

    @check('pmf', 'The PMF alias searches mathematics and natural sciences together')
    def pmf():
        data = call('unizg_courses', faculty='PMF', query='analiza', year=year, limit=100)
        assert {37, 119} <= {c['faculty_id'] for c in data['courses']}, data
        return {'matches': data['count']}

    @check('year', 'Omitting year uses the current academic year')
    def current_year():
        data = call('unizg_course', faculty='FER', code='222786')
        assert data['akademskaGodina'] == year, data.get('akademskaGodina')
        return {'academic_year': data['akademskaGodina']}

    @check('foi', 'FOI course enrichment supplies the syllabus missing from ISVU')
    def foi():
        data = call('unizg_course', faculty='FOI', code='214449', year=year)
        assert data.get('opis'), data
        assert data.get('ishodi_ucenja'), data
        assert any('nastava.foi.hr' in s.get('url', '') for s in data.get('sources', [])), data.get('sources')
        return {'outcomes': len(data['ishodi_ucenja'])}

    @check('fer', 'FER enrichment exposes outcomes and distinguishes recommended background')
    def fer():
        data = call('unizg_course', faculty='FER', code='222786', year=year)
        assert data.get('ishodi_ucenja'), data
        assert data.get('preporuceno_predznanje'), data
        assert any('fer.unizg.hr' in s.get('url', '') for s in data.get('sources', [])), data.get('sources')
        return {'outcomes': len(data['ishodi_ucenja']), 'formal_prerequisites': len(data['preduvjeti_upis'])}

    @check('sources', 'Source discovery locates Law outcomes and English-course entry points')
    def sources():
        law = call('unizg_sources', faculty_id=66)
        textile = call('unizg_sources', faculty_id=117)
        assert any('pravo.unizg.hr' in s.get('url', '') for s in law['sources']), law
        assert any('ttf.unizg.hr' in s.get('url', '') for s in textile['sources']), textile
        return {'law_routes': len(law['sources']), 'textile_routes': len(textile['sources'])}

    @check('content', 'Bounded syllabus search finds a topic absent from the course title')
    def content():
        data = call('unizg_discover', faculty='FER', query='grupiranje', candidate_query='strojno',
                    year=year, max_courses=12, limit=20)
        assert any(c['sifra'] == '222786' for c in data['courses']), data
        assert 'coverage' in data, data
        return {'matches': len(data['courses']), 'coverage': data['coverage']}

    selected = set(args.only.split(',')) if args.only else None
    if selected and selected - {c[0] for c in checks}:
        parser.error('Unknown --only check')
    failed = 0
    ran = 0
    for name, description, fn in checks:
        if selected and name not in selected:
            continue
        print(description, flush=True)
        start = time.monotonic()
        ran += 1
        try:
            evidence = fn()
            print(json.dumps({'check': name, 'status': 'PASS', 'seconds': round(time.monotonic()-start, 2),
                              'evidence': evidence}, ensure_ascii=False), flush=True)
        except Exception as exc:
            failed += 1
            print(json.dumps({'check': name, 'status': 'FAIL', 'seconds': round(time.monotonic()-start, 2),
                              'error': str(exc)}, ensure_ascii=False), flush=True)
    print(json.dumps({'checks': ran, 'passed': ran-failed, 'failed': failed}), flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
