#!/usr/bin/env python3
"""Audit the obligatory-course load for every programme the playground offers.

The playground select is catalog.programmes: studies with has_curriculum. This
script classifies each of those pages the same way unizg_dag_json does when
only_obavezni is set (semester panes, _grouped_tables, select_curriculum_rows,
merge_duplicates). It does not fetch course pages. Prerequisites do not decide
which rows are core.

Writes one JSON object per programme to --out (JSONL) and skips keys already
present, so a run can be resumed. A 429 from ISVU stops the crawl.
"""
import argparse
import json
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))
sys.path.insert(0, os.path.join(ROOT, "skills", "unizg-courses", "scripts"))

import isvu  # noqa: E402
from _core import select_curriculum_rows  # noqa: E402
import _core  # noqa: E402

SLOT = re.compile(
    r"^(izborni|izborna|izborno)\b|izborni (predmet|kolegij|blok)|izborna grupa",
    re.I,
)


def programmes_for(faculty_id, year):
    """Same filter as catalog.programmes, plus the fields the select drops."""
    raw = _core.call_tool("unizg_programmes", {"faculty_id": faculty_id, "year": year})
    if isinstance(raw, dict) and raw.get("error"):
        return raw
    out = []
    for block in raw.get("razine") or []:
        for study in block.get("studiji") or []:
            if not study.get("has_curriculum"):
                continue
            out.append({
                "razina": block.get("razina"),
                "razina_naziv": block.get("razina_naziv"),
                "izvedba": block.get("izvedba"),
                "izvedba_naziv": block.get("izvedba_naziv"),
                "smjer": study.get("smjer"),
                "naziv": study.get("naziv"),
                "tip": study.get("tip"),
                "kategorija": study.get("kategorija"),
                "semestara": study.get("semestara"),
                "depth": study.get("depth"),
            })
    return out


def _ects(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def diagnose(doc):
    """Classify one curriculum page and note where the markup does not match."""
    sems = isvu.split_semesters(doc)
    if not sems:
        return {"error": "no semester panes"}
    courses = []
    seen = set()
    elective_codes = set()
    groups = []
    slot_names = []
    unparsed = []
    mismatched = 0
    null_group_names = 0
    semester_numbers = []
    unrecorded = []
    per_sem = []
    for sem, chunk in sems:
        semester_numbers.append(sem)
        rows, skipped = select_curriculum_rows(isvu._grouped_tables(chunk), True)
        kept_core = False
        elective_codes.update(skipped)
        ob_n, ob_ects = 0, 0.0
        for grp, it in rows:
            if not it.get("sifra") or it["sifra"] in seen:
                continue
            seen.add(it["sifra"])
            kept_core = True
            ects = _ects(it.get("ects"))
            name = it.get("naziv") or ""
            courses.append({
                "naziv": name,
                "sifra": it["sifra"],
                "semestar": "zimski" if sem % 2 else "ljetni",
                "godina": (sem + 1) // 2,
                "status": "izborni" if grp else "obavezni",
                "ects": ects,
                "preduvjeti": [],
            })
            ob_n += 1
            ob_ects += ects
            if SLOT.search(isvu.fold(name).replace("đ", "dj")) or SLOT.search(name):
                slot_names.append(name)
        sem_groups = []
        for grp, items in isvu._grouped_tables(chunk):
            if not grp:
                continue
            if not grp.get("naziv"):
                null_group_names += 1
            sem_groups.append({
                "naziv": grp.get("naziv"),
                "min_ects": grp.get("min_ects"),
                "predmeta": len([it for it in items if it.get("sifra")]),
            })
        groups.extend(sem_groups)
        for tag, table_rows in isvu.tables(chunk, with_tag=True):
            keys = [h.strip() for h in table_rows[0]]
            if "Naziv" not in keys:
                joined = " ".join(keys)
                if any(token in joined for token in ("Šifra", "ECTS", "Predmet", "Kolegij")):
                    unparsed.append(keys)
                continue
            mismatched += sum(1 for row in table_rows[1:] if len(row) != len(keys))
        if not kept_core and not skipped:
            unrecorded.append(sem)
        per_sem.append({
            "semestar": sem,
            "obavezni": ob_n,
            "ects": round(ob_ects, 1),
            "grupe": len(sem_groups),
            "min_ects_grupa": round(sum(g["min_ects"] or 0 for g in sem_groups), 1),
        })
    merged_courses, merged = isvu.merge_duplicates(courses)
    ob_ects = round(sum(c["ects"] for c in merged_courses), 1)
    min_elective = round(sum(g["min_ects"] or 0 for g in groups), 1)
    n_sem = len(semester_numbers)
    # A full-time semester is about 30 ECTS. The page is thin when core plus
    # the published elective minimums stay under 20 per semester pane.
    thin = n_sem >= 2 and (ob_ects + min_elective) < 20 * n_sem
    very_low = n_sem >= 4 and len(merged_courses) <= 3 and len(elective_codes) < 5
    flags = []
    if not merged_courses and not groups:
        flags.append("empty")
    if not merged_courses and groups:
        flags.append("electives_only")
    if slot_names:
        flags.append("core_looks_like_slot")
    if unparsed:
        flags.append("unparsed_table")
    if null_group_names:
        flags.append("unnamed_group")
    if semester_numbers and min(semester_numbers) > 1:
        flags.append("starts_after_1")
    if thin:
        flags.append("thin_ects")
    if very_low:
        flags.append("very_low")
    # One-cell rows are Izborna grupa banners and "nije evidentirano" notices.
    # They are not dropped courses, so they are counted and not flagged.
    declared = None
    return {
        "semesters": semester_numbers,
        "semestri_bez_zapisa": unrecorded,
        "obavezni": len(merged_courses),
        "obavezni_sifre": len(seen),
        "ects": ob_ects,
        "izborne_grupe": len(groups),
        "izborni_sifre": len(elective_codes - seen),
        "min_ects_grupa": min_elective,
        "merged_duplicates": len(merged),
        "slot_names": slot_names[:8],
        "unparsed_headers": [h[:8] for h in unparsed[:4]],
        "ragged_rows": mismatched,
        "unnamed_groups": null_group_names,
        "per_sem": per_sem,
        "flags": flags,
        "declared_note": declared,
    }


def one(inst, programme, year):
    fid = inst["id"]
    key = f"{fid}|{programme['razina']}|{programme['izvedba']}|{programme['smjer']}"
    path = (f"/podaci/{fid}/nastavniprogram/{year}/razina/{int(programme['razina'])}"
            f"/izvedba/{programme['izvedba']}/smjer/{int(programme['smjer'])}")
    row = {
        "key": key,
        "faculty_id": fid,
        "fakultet": inst["naziv"],
        "grad": inst.get("grad"),
        **programme,
        "source": isvu.BASE + path,
    }
    try:
        doc = isvu.fetch(path)
        row.update(diagnose(doc))
    except isvu.RateLimited:
        raise
    except Exception as exc:
        row["error"] = f"{type(exc).__name__}: {exc}"
        row["flags"] = ["error"]
    return row


def load_done(path):
    done = set()
    if not os.path.exists(path):
        return done
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                done.add(json.loads(line)["key"])
            except (json.JSONDecodeError, KeyError):
                continue
    return done


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="/tmp/obavezni-audit/rows.jsonl")
    parser.add_argument("--year", type=int)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--faculty", type=int, action="append", default=[])
    args = parser.parse_args()
    year = args.year or isvu.current_academic_year()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    done = load_done(args.out)
    institutions = _core._institutions()
    if args.faculty:
        wanted = set(args.faculty)
        institutions = [inst for inst in institutions if inst["id"] in wanted]
    jobs = []
    faculty_errors = []
    for inst in institutions:
        try:
            programmes = programmes_for(inst["id"], year)
        except isvu.RateLimited:
            print("rate limited while listing faculties", flush=True)
            raise
        except Exception as exc:
            faculty_errors.append({"faculty_id": inst["id"], "fakultet": inst["naziv"],
                                   "error": f"{type(exc).__name__}: {exc}"})
            print(f"list fail {inst['id']} {inst['naziv']}: {exc}", flush=True)
            continue
        if isinstance(programmes, dict) and programmes.get("error"):
            faculty_errors.append({"faculty_id": inst["id"], "fakultet": inst["naziv"],
                                   "error": programmes["error"]})
            print(f"list error {inst['id']} {programmes['error']}", flush=True)
            continue
        fresh = 0
        for programme in programmes:
            key = f"{inst['id']}|{programme['razina']}|{programme['izvedba']}|{programme['smjer']}"
            if key in done:
                continue
            jobs.append((inst, programme))
            fresh += 1
        print(f"{inst['id']} {inst['naziv']}: {len(programmes)} programmes, {fresh} to fetch",
              flush=True)
    print(f"fetching {len(jobs)} programmes with {args.workers} workers", flush=True)
    lock = threading.Lock()
    write_error = os.path.join(os.path.dirname(args.out), "faculty-errors.json")
    with open(write_error, "w", encoding="utf-8") as handle:
        json.dump(faculty_errors, handle, ensure_ascii=False, indent=2)
    halted = False
    with open(args.out, "a", encoding="utf-8") as handle:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(one, inst, programme, year) for inst, programme in jobs]
            for done_n, future in enumerate(as_completed(futures), 1):
                try:
                    row = future.result()
                except isvu.RateLimited as exc:
                    print(f"stop: {exc}", flush=True)
                    halted = True
                    break
                with lock:
                    handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                    handle.flush()
                if done_n % 25 == 0 or row.get("error") or "unparsed_table" in row.get("flags", []):
                    flags = ",".join(row.get("flags") or []) or "ok"
                    print(f"{done_n}/{len(jobs)} {row['key']} {row.get('naziv')} [{flags}]",
                          flush=True)
            if halted:
                pool.shutdown(wait=False, cancel_futures=True)
    print("done" if not halted else "halted", flush=True)
    return 2 if halted else 0


if __name__ == "__main__":
    sys.exit(main())
