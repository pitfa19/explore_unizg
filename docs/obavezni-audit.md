# Obavezni kolegiji, audit of every programme in the select

Academic year 2026. Population is exactly what the playground select offers: every UNIZG sastavnica, then every study with `has_curriculum`. Classification is the same code as **Obavezni kolegiji studija**: semester panes, `isvu._grouped_tables`, `select_curriculum_rows(only_obavezni=True)`, `merge_duplicates`. Course pages were not fetched. Prerequisites do not decide which rows are core.

Vojni studiji is in the sastavnica list and publishes no curriculum, so the select stays empty there. The other 38 sastavnice offer the programmes below.

## Result

- Programmes checked: **1413** across **38** sastavnice.
- Core list loaded: **1273** (90.1%).
- No obligatory courses on the page: **140** (9.9%). The button now says so and does not draw a graph. 25 of these publish only elective groups; 115 say the semester is not recorded (`nisu evidentirani` / `nije definiran`).
- Of the 1273 that load, **904** start at semester 1 with every pane recorded. **168** are a later slice (the ISVU page starts after semester 1). **211** have at least one pane ISVU left unrecorded. A programme can be both.

## What was wrong, and what changed

Sveučilišni centar za protestantsku teologiju publishes course rows with one more cell than the header (a trailing hour column). The parser required an exact length, so all five of its programmes came back as 0 obligatory even though the courses were on the page. Rows that are longer than the header are now kept, aligned to the header. Shorter rows stay skipped: those are the "Izborna grupa" banners and the "nije evidentirano" notices. After the fix:

| Programme | Before | After |
|---|---:|---:|
| Protestantska teologija, redovni and izvanredni | 0 | 67 |
| Protestantska teologija, diplomski | 0 | 27 |
| Diplomski studij, izvanredni | 0 | 27 |
| Pripremna godina | 0 | 14 |

No other faculty's count changed. Elective groups are still excluded, including izborno-obavezni blocks.

When a page has no obligatory row, the button reports that instead of loading an empty selection. If the page has only elective groups, the message says so. When the record starts after semester 1, the status names the span (`Zapis pokriva semestre 3–6.`). When some panes are the unpublished notice, those semester numbers are listed too.

## FER Računarstvo is 18 because that page is semesters 3–6

Smjer 73, Računarstvo, prijediplomski redovni, is four panes numbered 3–6, not a six-semester bachelor. Obligatory ECTS plus the published elective minimums land on 30 in each of those semesters (28+2, 28+2, 18+2+10, 18+2+10). The common first year is a different ISVU study: smjer 71, Elektrotehnika i informacijska tehnologija i Računarstvo, semesters 1–2, 11 obligatory courses, 58 ECTS. Smjer 72 is the electrical track for semesters 3–6, 18 obligatory. The 18 is the core of that page. The status now says the record covers semesters 3–6.

## Pages with no core

These are unpublished or elective-only records, concentrated in specialist and doctoral studies. Medicina (integrirani, 82 obligatory, 343 ECTS, semesters 1–12) parses. The 54 empty Medicinski rows are specijalistički and doktorski studies whose panes say the courses are not recorded.

| Sastavnica | Programmes | No core | Only elective groups |
|---|---:|---:|---:|
| Medicinski fakultet | 58 | 54 | 0 |
| Ekonomski fakultet | 100 | 39 | 0 |
| Filozofski fakultet | 180 | 11 | 9 |
| Fakultet elektrotehnike i računarstva | 38 | 7 | 7 |
| Fakultet filozofije i religijskih znanosti | 12 | 4 | 0 |
| Akademija likovnih umjetnosti | 31 | 3 | 0 |
| Fakultet organizacije i informatike | 39 | 3 | 1 |
| Pravni fakultet | 69 | 3 | 0 |
| Prehrambeno-biotehnološki fakultet | 18 | 3 | 3 |
| Prirodoslovno-matematički fakultet-matematički odsjek | 18 | 3 | 0 |
| Agronomski fakultet | 38 | 2 | 1 |
| Fakultet zdravstvenih studija | 37 | 2 | 0 |
| Učiteljski fakultet | 37 | 2 | 1 |
| Farmaceutsko-biokemijski fakultet | 13 | 1 | 1 |
| Građevinski fakultet | 17 | 1 | 1 |
| Katolički bogoslovni fakultet | 19 | 1 | 0 |
| Muzička akademija | 38 | 1 | 1 |

## Suspicious, but the split on the page is real

**Later slices.** 168 programmes start at semester 3, 5 or similar. FER Računarstvo is the clearest case. The courses on the page are obligatory for that slice. Earlier semesters live on another smjer, and this page does not contain them.

**Unrecorded later panes.** Farmacija (farmaceutsko-biokemijski, integrirani) has 11 obligatory courses in semesters 1–2 and the notice "Obavezni predmeti za semestar nisu evidentirani" on semesters 3–10. The same pattern appears on several PMF physics research tracks and on one stomatološki module. The load keeps the recorded core and names the missing semesters. It does not invent the rest.

**Titles that look elective inside a mandatory table.** Fakultet filozofije i religijskih znanosti lists courses such as "Izborni predmet iz filozofije spoznaje: Percepcija i memorija" in the mandatory table, beside separate elective groups. ISVU did not put them in an Izborna grupa, so they stay in the core. "Izborni sustavi" on Fakultet hrvatskih studija is a course about electoral systems, not a slot. Veterinarski has one mandatory row, "Izborni predmeti, perinatalne bolesti mladunčadi", among 17 core courses and no elective group. It stays, because the page gives it a code and a place in the mandatory table.

No faculty used a course table the parser could not read. Headers are Šifra / Naziv / ECTS throughout. One-cell banner rows inside a mandatory table are labels for the elective tables that follow them. No course row was found after such a banner in the same non-elective table.

Per-programme numbers are in `docs/obavezni-audit.csv`.
