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

## Rendering: semester columns and where each course lands

The graph used to place every course as early as its prerequisites allow, and it only drew columns up to that earliest semester. Obligatory courses carry almost no upis prerequisites, so a zimski course from year 2 landed in semester 1 and a ljetni course, including Diplomski rad, landed in semester 2. Year 2 disappeared even though the ISVU page has panes 1–4.

A programme load now floors each course at its curriculum semester, and the graph draws every semester from the first recorded pane through the last, including panes that hold only an elective group. Each Izborna grupa is a dashed card (`min N ECTS` when ISVU publishes `najmanje N`, otherwise the group's own opis). It is not added to the selection. Clicking it lists the options.

Checked against the same 1413 programmes. For every programme that has obligatory courses:

- Recorded panes missing from the rendered columns: **0**.
- Kept courses whose semester is not one of those columns: **0**.
- Programmes whose old graph hid a later pane: **1176** of 1273. That is the bug this change removes. The flag in the CSV is `span_was_collapsed`; `skriveni_prije` is the list of panes the old graph did not draw, and `skupljeni` is how many courses it pulled into an earlier semester.

FER Data Science (smjer 99) and Znanost o podacima (smjer 91) are the case that prompted this. Both publish semesters 1–4. Data Science has 9 obligatory courses; three of them (Mentorski seminar, Napredni algoritmi i strukture podataka, Diplomski rad) sit in semesters 3 and 4. Diplomski rad is semester 4, 30 ECTS, and ISVU publishes no upis prerequisite, which is why it used to collapse into semester 2. The same is true of Znanost o podacima (8 obligatory, Diplomski rad in semester 4). Neither page merges or drops those rows.

FER Računarstvo (smjer 73) is still semesters 3–6 only. The graph starts at semester 3. Završni rad stays in semester 6. Empty columns 1–2 are not invented: those courses live on smjer 71.

Medicina (integrirani, smjer 3) draws semesters 1–12. Diplomski rad, Završni ispit and Diplomski ispit are in semester 12. Filozofija at Filozofski fakultet (prijediplomski, smjer 108) draws semesters 1–6. Semester 4's only obligatory row is Tjelesna i zdravstvena kultura 4; the rest of that column is the elective groups. Završni ispit is in semester 6.

Two placement limits remain, and both are reported rather than papered over:

- **91** programmes list the same course title twice (`merged_earlier`). The graph keeps one row: the higher ECTS, or the earlier semester when the ECTS match. Geodezija (diplomski, smjer 731) lists Diplomski rad at 30 ECTS in semester 3 and again, under another code, at 30 ECTS in semester 4. One card is drawn, in semester 3. The semester 4 column is still there.
- A year-long course often reuses one ISVU code for "(1/2)" and "(2/2)" with different titles. The second half used to be dropped before the graph ever saw it. Both halves are kept now, in their own semesters, with distinct ids. That raised the obligatory count on **108** programmes, mostly Muzička akademija (37), Fakultet prometnih znanosti (22) and Akademija likovnih umjetnosti (20). Fakultet filozofije i religijskih znanosti, Filozofija diplomski, went from 15 to 16 because Diplomski rad (2/2) in semester 4 is no longer discarded. Protestantska teologija did not change.

The audit does not fetch course pages, so it does not see a prerequisite pushing a course later than its pane. On the four programmes above, the thesis, završni rad and the year-2 seminars publish no upis prerequisite, so the floor is where they land.
