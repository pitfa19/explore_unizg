# Horizontalna mobilnost eval

Why `unizg_mobility_rules` and the mobility block in `INSTRUCTIONS` exist, and the measurement that
shaped them. Six probe questions in `probes.md`, run past Haiku, Sonnet and Opus as subagents, before
and after the change. Each model was handed the server instructions and tool list verbatim, as if they
had arrived from the server, and asked to answer a student.

Verdicts are per probe. **AFFIRMS** means the student was told cross-faculty enrolment is a real,
established possibility. **HEDGES** means they were told it might not be allowed, told to go and check
whether it was possible at all, or given no answer.

| model | before | after | called the tool | invented content |
|---|---:|---:|---|---|
| Haiku | 2/6 | **6/6** | yes, at P1 | before: refused instead. after: none |
| Sonnet | 6/6 | **6/6** | yes, at P1 | before: fee and recognition rule. after: none |
| Opus | 6/6 | **6/6** | yes, at P1 | before: passed on a dead URL. after: none |

## What it caught

**Three models, three different failures, and only one of them was the obvious one.**

Haiku affirmed the two direct questions and then deflected all four substantive ones with variations of
`to nije dostupno u katalogu`. That is the failure the change was aimed at.

Sonnet affirmed every probe and then made the content up. It told the student mobility
`uobičajeno se ne naplaćuje dodatno` (PMF charges €7 for the molba) and that the grade lands in the home
programme like any other course, which inverts the two facts that matter most: recognition is opt-in,
and failing costs nothing. **Affirming without the rules is not a fix, it is a different way to
misinform.** This is the finding that decided the shape of the change: ship the rules, not merely
permission to say yes.

Opus affirmed every probe and was the only model that declined to invent numbers
(`ne mogu ti reći ni traženi prosjek ni cijenu bez izmišljanja`). It did faithfully pass on the FKIT
link that the old instructions carried, and that URL 404s — a real bug in the instructions, found only
because a model repeated it to a student. Links in instruction text now get checked, and the reference
file records when.

## Reproducing

```bash
python3 docs/evals/gen_after.py     # regenerates the harness from the live server text
```

Then give a subagent `server_after.md` plus `probes.md` and ask it to answer all six as it would answer
a student. `gen_after.py` writes the harness next to itself, including a payload file standing in for
the tool result, since a subagent cannot reach the MCP server.

Re-run this after editing the mobility text. The probes are cheap and the failure modes are quiet: both
of the bad outcomes above read as confident, helpful answers.
