# Official faculty sources beyond ISVU

Checked 2026-10-25. The executable directory is `api/_sources.py`. Verified routes do not mean complete faculty coverage. Unlisted institutions and source kinds are **unknown**, not evidence of absent teaching information.

## Retrieval support

| Institution | Route | Support and year handling |
|---|---|---|
| FER 36 | `https://www.fer.unizg.hr/studiji/diplomski_studiji`, linked `/studiji/dipl/{eit,ikt,rac}/{profile}` catalogues, and `/studiji/fer3/{racunarstvo,eit}` | Bounded discovery of exact normalized course-name links, followed by verification of language-labelled ISVU code on the actual course page. No course-specific slug lookup. Only the explicitly selected HTML academic year is supported. Historical year switching requires JavaScript POST and is **not implemented**. |
| FOI 16 | `https://nastava.foi.hr/course/{code}/{year}-{next_year}` | Code-addressed HTML, exact normalized title and displayed year required. Extracts objective/description, syllabus, course outcomes and faculty prerequisite statement. |
| PMF mathematics 37 | `https://www.pmf.unizg.hr/math/studenti/nastava` | Directory links course list, annual study-plan PDF, teaching/exam calendars and historical plans. Directory-only, no extraction of PDFs or events. Distinct from 119. |
| PMF natural sciences 119 | `https://www.pmf.unizg.hr/chem/predmet/bio1_b` | Verified chemistry example, **not** a complete natural-science source map. No enrichment adapter. |
| PBF 58 | `https://www.pbf.unizg.hr/predmet/bio1_g` | Verified course example only. No enrichment adapter. |
| Pravni 66 | `https://www.pravo.unizg.hr/studiji/izvedbeni-planovi-ishodi-ucenja/` | Locates outcome/study-plan documents. PDF text extraction **not implemented**. Read individual document year. |
| TTF 117 | `https://www.ttf.unizg.hr/en/study-courses-in-english/730` | English-offering list located, labeled 2026/2027 at check. Not joined to course records. |
| Central UNIZG 9996 | `https://www.unizg.hr/homepage/study-at-the-university-of-zagreb/degrees-studies-and-courses/studies-and-courses-in-english/` | Faculty English-source directory, not proof all offerings are current or available. |
| Central UNIZG 9996 | `https://www.unizg.hr/studiji-i-studiranje/studiji/nastava/` | Annual academic-calendar directory, not actual class timetable extraction. |
| FOI 16 | `https://www.foi.unizg.hr/hr/horizontalna-mobilnost` | Forms/procedure/catalogue directory. Linked English catalogue labeled 2025/2026 at check. |
| FOI 16 | `https://nastava.foi.hr/student-schedule` | Timetable entry point only, no event extraction. |

## Public integration contract

```python
sources_for(faculty_id=None, kind=None)
enrich_course(record, fetch)
```

`fetch` is the existing injected client accepting an absolute URL and returning HTML text. The module adds no dependency, transport, paid service, persistence or background crawler.

The input course record uses `faculty_id`, `sifra`, `naziv`, and `akademskaGodina`; CLI `institution` is also accepted. The returned record is a deep copy. Existing `opis` and both formal lists (`preduvjeti_upis`, `preduvjeti_polaganje`) are preserved. Missing `opis` can be filled. Additions may include:

- `ishodi_ucenja`: course outcomes only, excluding programme-wide outcomes.
- `syllabus`: FOI teaching content.
- `recommended_background` and `preporuceno_predznanje`: FER text explicitly about prior knowledge, not formal passed-course enrollment requirements.
- `prerequisite_statement`: attributed faculty text and status `explicit_none` or `published_text`. An explicit-none faculty statement does **not** erase conflicting ISVU formal entries; conflict produces a warning.
- `source_enrichment`: `status`, added `fields`, and attributed `sources` with URL, identity evidence, requested/displayed academic year, coverage, and adapter check date.
- `source_warnings`: existing warnings retained, followed by fetch, identity, year, missing-section and conflict warnings. Ordinary failures preserve the base ISVU course record. Any exception with `stop_fetching=True` propagates immediately through both FER discovery and enrichment, so rate limits halt the caller.
- `sources`: existing top-level provenance retained, with the verified faculty source appended. Enrichment source `checked_date` is the runtime `date.today().isoformat()`, not the static directory audit date.
- `opis_source`: faculty URL only when this call fills a missing description. Existing description provenance is preserved.

`source_enrichment.status == "verified"` means identity and year matched, not complete eligibility information. Unknown fields remain unknown. FER discovery is bounded to 32 programme pages and may miss doctoral, historical, differently named or otherwise unlinked courses. Only official same-host catalogue/course paths are followed.

Directory `kind` values: `course`, `programme_outcomes`, `english_courses`, `calendar`, `mobility`, `timetable`. The directory lists unmapped known institution IDs explicitly. Its institution snapshot does not replace live ISVU enumeration.

## Validation evidence

Tests were written before the module. Initial command `python3 -m unittest api.test_sources -v` failed with `ModuleNotFoundError: No module named 'api._sources'` (one loader error). After implementation, 10 tests passed. Expanded suite initially found a genuine year-validation bug: an unrelated selected-year control incorrectly made a FER record verified. The single regression failed with `'verified' != 'unknown'`; scoping the selection to FER's academic-year control fixed it. A separate source-kind-filter regression failed because FER was not listed as unmapped for calendars; computing unknown coverage against the filtered routes fixed it.

Final local command `python3 -m unittest api.test_sources -v`: **24 tests passed**. Follow-up contract tests first produced 6 failures and 2 errors (including three stop-fetching subcases), then all passed after provenance, alias, runtime-date, warning-preservation and rate-limit corrections. Fixtures preserve minimal independently observed FOI and FER HTML structures. Coverage includes wrong-code same-name rejection, other FER course discovery, fetch failure, input preservation, historical years, unknown faculties/sections, course-vs-programme outcomes, prerequisite classification/conflicts and off-domain link rejection.

Read-only live checks on 2026-10-25, using the same public enrichment function with an HTTP GET callback:

- FOI Programiranje 1, 214449, 2026/2027: description, syllabus, **12 course outcomes**, explicit no-defined-prerequisites statement.
- FER Strojno učenje 1, 222786, 2026/2027: discovered through official catalogues in **6 GETs**, description, **8 outcomes**, prior-knowledge text, no formal-prerequisite substitution.
- FER Uvod u programiranje, 183357, 2026/2027: discovered independently in **3 GETs**, description and **7 outcomes**. Missing prerequisite/background section correctly remained unknown.

These samples verify retrieval and identity handling, not university-wide completeness. No production writes were performed.
