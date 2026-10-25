# Discovery coverage verification, 2026-10-25 UTC

## Scope

This change improves the tool's ability to locate teaching information. It is not a complete
university-wide content index. No person indexing, translation service, background crawl or new
dependency was added.

## Verifiers before implementation

Commit `6722517` adds public MCP-dispatch regression tests and an independent HTTP acceptance
script before implementation. Initial dispatcher tests failed (7 failures, 2 errors). All nine
HTTP acceptance behaviors were reproduced as failing on the original production revision
`0628645292b9447bc12aac1b6ac99de5ac2bb2cf`, including an independently confirmed 2025 year default.

Faculty-source and bounded-discovery tests were also written before their implementations.
Additional failing regressions caught year-selector confusion, missing filtered-source coverage,
provenance mismatches, suppressed rate-limit exceptions, Croatian folding, ignored outcome and
syllabus fields, and extreme-number validation. Each was fixed and rerun.

## Local results

Offline public-contract regression suite: source matching, discovery bounds, unknown values,
formal prerequisite preservation, errors and transport dispatch.

- `python3 -m unittest discover -s api -p 'test_*.py' -q`: **59 passed**.
- `git diff --check`: passed.
- Local stdio initialize: **version 1.1.0**; tools/list: **9 tools**.

Live HTTP acceptance suite: the unchanged deployment handler, using actual official sources.

Command: `python3 scripts/verify_discovery.py --endpoint http://127.0.0.1:8901/api/mcp`.
Result: **9/9 passed**, approximately **58 seconds** total on the initial local run.

| Task | Observed result |
|---|---|
| Advertised tools | 9 tools including source and content discovery |
| Live institution roster | 39, including central 9996 and both PMF divisions |
| Central-university title search | Finds Patenti u biotehnologiji, 262687 |
| PMF alias | Both 37 and 119, 68 analysis-title matches |
| Omitted academic year | 2026, meaning 2026/2027 |
| FOI 214449 | Nonempty description and 12 structured outcomes |
| FER 222786 | 8 outcomes and separate recommended background |
| Additional-source routes | Law outcomes directory and TTF English list |
| Topic absent from title | grupiranje finds 222786 among 3 matches; 9 candidates examined |

The last query explicitly reports title-bounded candidates and missing/unverified content. Its
success demonstrates retrieval, not exhaustive coverage or absence of unmatched topics.

## Reproducing publication checks

Production is published by the existing Vercel integration on `main`. After deployment:

```bash
python3 scripts/verify_discovery.py --endpoint https://horizontal-mobility.vercel.app/api/mcp
```

Verify the GitHub deployment SHA and success status, then rerun the independent HTTP suite.
Live failures can indicate upstream changes; fixture success must not override them. This file
records pre-publication evidence only. The publication outcome is reported separately after it occurs.

## Remaining limits

- All currently published UNIZG ISVU institutions are enumerated. Additional faculty sources are
  only mapped for a subset and explicitly list unmapped coverage.
- Automated rich HTML retrieval supports FER and FOI. FER catalogue discovery is bounded and
  rejects unsupported historical-year pages or mismatched identities.
- Law PDF routes, annual English-offering lists, calendars, mobility forms and timetables can be
  located where mapped. PDF contents/events are not extracted or joined into a complete database.
- Content discovery examines at most 100 course records per call and reports missing content,
  source warnings, failures, filters with unknown values and truncation. No translation or synonyms.
- Recommended prior knowledge is not reclassified as a formal enrollment prerequisite. Existing
  unresolved prerequisite graph references remain reported, not guessed.
