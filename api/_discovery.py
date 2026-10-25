"""Bounded, on-demand course content discovery without an index or core import."""
from collections import deque
import html
import math
import re
import unicodedata


def _text(value):
    if isinstance(value, (list, tuple)):
        return " ".join(_text(item) for item in value)
    if not isinstance(value, str):
        return ""
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", value)).split())


def _fold(value):
    return "".join(c for c in unicodedata.normalize("NFD", value.casefold().replace("đ", "dj"))
                   if not unicodedata.combining(c))


def _validate(args):
    if not isinstance(args, dict):
        return "Arguments must be an object."
    for key in ("query", "candidate_query", "language"):
        if key == "query" or key in args:
            value = args.get(key)
            if not isinstance(value, str) or not _fold(_text(value)).strip():
                return f"{key} must be a nonempty string."
    for key, default in (("max_courses", 30), ("limit", 20)):
        value = args.get(key, default)
        if type(value) is not int or not 1 <= value <= 100:
            return f"{key} must be an integer from 1 to 100."
    if "semester" in args and (type(args["semester"]) is not int or args["semester"] < 1):
        return "semester must be a positive integer."
    if "status" in args and args["status"] not in ("obavezni", "izborni"):
        return "status must be obavezni or izborni."
    for key in ("ects_min", "ects_max"):
        if key in args:
            value = args[key]
            if type(value) not in (int, float) or _number(value) is None:
                return f"{key} must be a finite nonnegative number."
    if args.get("ects_min", 0) > args.get("ects_max", math.inf):
        return "ects_min must not exceed ects_max."
    return None


def _number(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) and value >= 0 else None
    except (ValueError, TypeError, OverflowError):
        return None


def _matches_filters(record, args, unknown):
    """Unknown evidence is not a match, and is explicitly counted, not silently false."""
    matches = True
    if "ects_min" in args or "ects_max" in args:
        ects = _number(record.get("ects"))
        if ects is None:
            unknown["ects"] += 1
            matches = False
        elif not args.get("ects_min", 0) <= ects <= args.get("ects_max", math.inf):
            matches = False
    if "language" in args:
        language = _text(record.get("jezici"))
        if not language:
            unknown["language"] += 1
            matches = False
        elif _fold(_text(args["language"])) not in _fold(language):
            matches = False
    programme_filters = [(key, field) for key, field in (("semester", "semestar"), ("status", "status"))
                         if key in args]
    if programme_filters:
        programmes = record.get("programmes") or []
        programmes = [p for p in programmes if isinstance(p, dict)] if isinstance(programmes, list) else []
        programme_match = False
        unknown_fields = set()
        for programme in programmes:
            row_match = True
            row_unknown = set()
            row_mismatch = False
            for key, field in programme_filters:
                raw = programme.get(field)
                value = _number(raw) if key == "semester" else _fold(_text(raw))
                if value is None or value == "":
                    row_unknown.add(key)
                    row_match = False
                elif value != args[key]:
                    row_mismatch = True
                    row_match = False
            programme_match |= row_match
            # A partially unknown row matters only if its known fields could match.
            if not row_mismatch:
                unknown_fields.update(row_unknown)
        if not programmes:
            unknown_fields.update(key for key, _ in programme_filters)
        if not programme_match:
            for key in unknown_fields:
                unknown[key] += 1
            matches = False
    return matches


def _snippet(field, text, needle):
    # Preserve original Croatian text despite casefold expansions / combining marks.
    folded_parts, positions = [], []
    for index, character in enumerate(text):
        part = _fold(character)
        folded_parts.append(part)
        positions.extend([index] * len(part))
    offset = "".join(folded_parts).find(needle)
    if offset < 0:
        return None
    start = max(0, positions[offset] - 80)
    end = min(len(text), max(start + 240, positions[offset + len(needle) - 1] + 1))
    # Query itself can be long. Still keep the response bounded.
    end = min(end, start + 360)
    return {"field": field, "text": ("…" if start else "") + text[start:end] + ("…" if end < len(text) else "")}


def discover(args, faculty_ids, year, course_list, course_detail):
    """Search title, description, syllabus and outcomes of at most max_courses fetched records.

    callbacks: course_list(faculty_id, year), course_detail(faculty_id, code, year).
    Candidate count covers successfully loaded lists after optional title bounding.
    Examined count includes failed detail attempts. Exhausted means all known
    candidates were attempted, not that upstream publication is complete.
    Unknown filter counts cover fetched records matching the content query.
    """
    error = _validate(args)
    if error:
        return {"error": error}
    faculties = list(dict.fromkeys(faculty_ids))
    coverage = {"faculties_requested": faculties, "faculties_failed": [],
                "candidate_count": 0, "examined_count": 0, "failed_count": 0,
                "exhausted": False, "result_truncated": False, "incomplete_reason": [],
                "missing_content_values": {"opis": 0, "ishodi": 0},
                "incomplete_enrichment_count": 0,
                "unknown_filter_values": {"ects": 0, "semester": 0, "status": 0, "language": 0}}
    failures, warnings, queues, hits = [], [], deque(), []
    source_warnings = []
    needle = _fold(_text(args["query"]))
    candidate_needle = _fold(_text(args.get("candidate_query")))
    for fid in faculties:
        try:
            rows = course_list(fid, year)
            if not isinstance(rows, list):
                raise ValueError("Course list callback did not return a list")
            candidates, seen = [], set()
            for row in rows:
                if not isinstance(row, dict) or row.get("sifra") is None:
                    raise ValueError("Course list contains a record without sifra")
                code = str(row["sifra"])
                if code not in seen and candidate_needle in _fold(_text(row.get("naziv"))):
                    candidates.append((code, row))
                    seen.add(code)
            coverage["candidate_count"] += len(candidates)
            if candidates:
                queues.append((fid, deque(candidates)))
        except Exception as exc:
            if getattr(exc, "stop_fetching", False):
                raise
            coverage["faculties_failed"].append(fid)
            failures.append({"stage": "course_list", "faculty_id": fid, "error": str(exc)[:300]})
    while queues and coverage["examined_count"] < args.get("max_courses", 30):
        fid, candidates = queues.popleft()
        code, listed = candidates.popleft()
        if candidates:
            queues.append((fid, candidates))
        coverage["examined_count"] += 1
        try:
            record = course_detail(fid, code, year)
            if not isinstance(record, dict) or record.get("error"):
                raise ValueError(record.get("error") if isinstance(record, dict) else "Invalid course detail record")
        except Exception as exc:
            if getattr(exc, "stop_fetching", False):
                raise
            coverage["failed_count"] += 1
            failures.append({"stage": "course_detail", "faculty_id": fid, "sifra": code, "error": str(exc)[:300]})
            continue
        title = _text(record.get("naziv")) or _text(listed.get("naziv"))
        if not _text(record.get("opis")):
            coverage["missing_content_values"]["opis"] += 1
        if not (_text(record.get("ishodi")) or _text(record.get("ishodi_ucenja"))):
            coverage["missing_content_values"]["ishodi"] += 1
        enrichment = record.get("source_enrichment")
        record_warnings = record.get("source_warnings") or []
        if (not isinstance(enrichment, dict) or enrichment.get("status") != "verified"
                or record_warnings):
            coverage["incomplete_enrichment_count"] += 1
        if record_warnings:
            source_warnings.append({"faculty_id": fid, "sifra": code, "warnings": record_warnings})
        snippets = []
        for field, value in (("naziv", title), ("opis", record.get("opis")),
                             ("ishodi", record.get("ishodi")), ("ishodi_ucenja", record.get("ishodi_ucenja")),
                             ("syllabus", record.get("syllabus"))):
            snippet = _snippet(field, _text(value), needle)
            if snippet:
                snippets.append(snippet)
        if not snippets or not _matches_filters(record, args, coverage["unknown_filter_values"]):
            continue
        hit = {"faculty_id": fid, "sifra": code, "naziv": title, "akademskaGodina": year,
               "ects": _number(record.get("ects")), "jezici": record.get("jezici"),
               "source": record.get("source"), "snippets": snippets}
        # Preserve additional provenance supplied by optional faculty enrichment.
        for key in ("faculty_source", "sources", "source_url", "opis_source", "ishodi_source",
                    "source_enrichment", "source_warnings"):
            if key in record:
                hit[key] = record[key]
        hits.append(hit)
    coverage["exhausted"] = coverage["examined_count"] == coverage["candidate_count"]
    reasons = coverage["incomplete_reason"]
    if candidate_needle:
        reasons.append("candidate_query restricted candidates by title")
    if not coverage["exhausted"]:
        reasons.append("max_courses bounded the number of detail fetches")
    if coverage["faculties_failed"]:
        reasons.append("faculty course-list fetch failures")
    if coverage["failed_count"]:
        reasons.append("course-detail fetch failures")
    if any(coverage["missing_content_values"].values()):
        reasons.append("description or learning outcomes missing from fetched records")
    if coverage["incomplete_enrichment_count"]:
        reasons.append("faculty enrichment missing, unverified or accompanied by source warnings")
    limit = args.get("limit", 20)
    coverage["result_truncated"] = len(hits) > limit
    if coverage["result_truncated"]:
        reasons.append("result limit omitted confirmed matches")
    if any(coverage["unknown_filter_values"].values()):
        reasons.append("unknown requested filter values")
        warnings.append("Some matching courses have unknown filter values and were not included. Missing teaching language does not establish that a language is not taught.")
    if reasons:
        warnings.insert(0, "Discovery is bounded, not exhaustive: " + "; ".join(reasons) + ".")
    warnings.append("Matches use only published title, description, syllabus and outcomes, without translations or synonyms. Exhausted means all known candidates were attempted, not complete syllabus coverage. Missing published content cannot establish absence of a topic.")
    return {"count": min(len(hits), limit), "total_matches": len(hits), "courses": hits[:limit],
            "coverage": coverage, "warnings": warnings, "failures": failures,
            "source_warnings": source_warnings}
