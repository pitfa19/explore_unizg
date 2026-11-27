"""Cached course spine for the playground. Reuses the ISVU client. Ships no dataset.

GET /api/catalog?op=spine returns titles and codes for every discovered UNIZG
faculty. Course pages are fetched only by op=course, and only for a selection.
op=dag reuses unizg_dag_json for a whole programme.
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _core  # noqa: E402

isvu = _core.isvu

SPINE_TTL = 6 * 3600
_SPINE_MEM = {}

# Short labels for the tray. Unknown faculties fall back to the official name.
SHORT = {
    36: "FER", 37: "PMF-mat", 119: "PMF", 130: "FFZG", 120: "FSB", 67: "EFZG",
    58: "PBF", 125: "FKIT", 16: "FOI", 108: "MEF", 66: "Pravni", 54: "Arhitektonski",
    178: "Agronomski", 13: "ERF", 15: "FPZG", 135: "FPZ", 195: "RGN", 34: "KIF",
    53: "VEF", 1053: "ADU", 381: "ALU", 1349: "MUZA", 117: "TTF", 82: "Građevinski",
    128: "Grafički", 7: "Geodetski", 6: "FBF", 65: "Stomatološki", 68: "Šumarski",
    131: "Učiteljski", 124: "Metalurški", 160: "Geotehnički", 203: "KBF",
    2223: "FHS", 2225: "FFRZ", 251: "Protestantska teologija", 9950: "Vojni studiji",
    9996: "Sveučilište",
}


def short_name(inst):
    sid = inst.get("id")
    if sid in SHORT:
        return SHORT[sid]
    return inst.get("naziv") or str(sid)


def public_institution(inst):
    return {
        "id": inst["id"],
        "naziv": inst.get("naziv") or str(inst["id"]),
        "grad": inst.get("grad"),
        "kratko": short_name(inst),
    }


def institution_by_id(fid):
    fid = int(fid)
    for inst in _core._institutions():
        if inst["id"] == fid:
            return public_institution(inst)
    return {"id": fid, "naziv": str(fid), "grad": None, "kratko": SHORT.get(fid, str(fid))}


def _year(args):
    raw = args.get("year")
    if raw in (None, ""):
        return isvu.current_academic_year()
    year = int(raw)
    if year < 1976:
        raise ValueError("year must be an academic-year start of 1976 or later.")
    return year


def _norm_uvjet(value):
    folded = isvu.fold(str(value or ""))
    return "odslusan" if folded.startswith("odsl") else "polozen"


def placement(programmes):
    """Earliest published programme row. Odd semesters are zimski."""
    rows = []
    for prog in programmes or []:
        sem = prog.get("semestar")
        if isinstance(sem, bool) or not isinstance(sem, int) or sem < 1:
            continue
        status_txt = isvu.fold(prog.get("status") or "")
        status = "izborni" if "izbor" in status_txt else "obavezni"
        rows.append((sem, status))
    if not rows:
        return "zimski", 1, "obavezni", "ISVU nije vratio smještaj u nastavnom programu."
    sem, status = min(rows, key=lambda row: row[0])
    note = None
    if len({row[0] for row in rows}) > 1:
        note = "Kolegij je u više programa; uzet je najraniji semestar."
    return ("zimski" if sem % 2 else "ljetni"), (sem + 1) // 2, status, note


def shape_course(record, institution):
    """Playground row from an unizg_course record. Teacher fields stay out."""
    if not isinstance(record, dict) or record.get("error"):
        return record if isinstance(record, dict) else {"error": "No course record."}
    season, godina, status, note = placement(record.get("programmes"))
    try:
        ects = float(record["ects"]) if record.get("ects") is not None else 0.0
    except (TypeError, ValueError):
        ects = 0.0
    prereqs = []
    for prereq in record.get("preduvjeti_upis") or []:
        name = str(prereq.get("kolegij") or "").strip()
        if name:
            prereqs.append({"kolegij": name, "uvjet": _norm_uvjet(prereq.get("uvjet"))})
    fid = institution["id"]
    code = str(record.get("sifra") or "")
    out = {
        "id": f"{fid}:{code}",
        "faculty_id": fid,
        "sifra": code,
        "fakultet": institution["kratko"],
        "naziv": record.get("naziv") or "",
        "ects": ects,
        "semestar": season,
        "godina": godina,
        "status": status,
        "preduvjeti": prereqs,
        "izvor_preduvjeti": prereqs,
        "akademskaGodina": record.get("akademskaGodina"),
        "source": record.get("source"),
    }
    if note:
        out["napomena"] = note
    return out


def _read_faculty_courses(fid, year):
    rows = []
    for course in isvu.course_list(fid, year):
        code = str(course.get("sifra") or "").strip()
        name = str(course.get("naziv") or "").strip()
        if code and name:
            rows.append({"faculty_id": fid, "sifra": code, "naziv": name})
    return rows


def build_spine(year):
    institutions = [public_institution(inst) for inst in _core._institutions()]
    ids = [inst["id"] for inst in institutions]
    if len(ids) > 1:
        isvu.fetch_all([isvu.course_list_path(fid, year) for fid in ids])
    courses, failed = [], []
    for fid in ids:
        try:
            courses.extend(_read_faculty_courses(fid, year))
        except isvu.RateLimited:
            raise
        except Exception:
            failed.append(fid)
    return {
        "akademskaGodina": year,
        "institutions": institutions,
        "courses": courses,
        "count": len(courses),
        "coverage": {
            "faculties_requested": ids,
            "faculties_failed": failed,
            "complete": not failed,
            "scope": "course titles and codes only; details are fetched per selected course",
        },
        "source": "ISVU public catalog, fetched live and cached. This repository ships no dataset.",
    }


def _spine_file(year):
    return f"/tmp/isvu-spine-{int(year)}.json"


def peek_spine(year):
    now = time.time()
    mem = _SPINE_MEM.get(year)
    if mem and now - mem[0] < SPINE_TTL:
        return mem[1]
    path = _spine_file(year)
    try:
        if os.path.exists(path) and now - os.path.getmtime(path) < SPINE_TTL:
            with open(path, encoding="utf-8") as handle:
                payload = json.load(handle)
            _SPINE_MEM[year] = (now, payload)
            return payload
    except (OSError, ValueError):
        return None
    return None


def load_spine(year):
    cached = peek_spine(year)
    if cached is not None:
        return cached
    payload = build_spine(year)
    _SPINE_MEM[year] = (time.time(), payload)
    path = _spine_file(year)
    try:
        tmp = path + f".{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
        os.replace(tmp, path)
    except OSError:
        pass
    return payload


def filter_courses(courses, query, faculty_id, limit):
    needle = isvu.fold(query or "")
    fid = int(faculty_id) if faculty_id not in (None, "") else None
    hits = []
    for course in courses:
        if fid is not None and int(course["faculty_id"]) != fid:
            continue
        if needle and needle not in isvu.fold(course["naziv"]) and needle not in isvu.fold(str(course["sifra"])):
            continue
        hits.append(course)
    return hits[:limit], len(hits)


def search(args):
    query = str(args.get("q") or args.get("query") or "").strip()
    faculty_id = args.get("faculty_id") or ""
    needle = isvu.fold(query)
    if len(needle) < 2:
        return {"error": "Upiši barem dva slova. Pretraga je bez dijakritika: racunarstvo nalazi Računarstvo."}
    limit = args.get("limit") or 40
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        return {"error": "limit must be an integer."}
    limit = max(1, min(limit, 80))
    year = _year(args)
    cached = peek_spine(year)
    if cached is not None:
        hits, total = filter_courses(cached["courses"], query, faculty_id, limit)
        return {
            "akademskaGodina": year,
            "query": query,
            "faculty_id": int(faculty_id) if faculty_id not in ("", None) else None,
            "count": len(hits),
            "total_matches": total,
            "courses": hits,
            "coverage": cached.get("coverage"),
            "from": "spine",
        }
    if faculty_id not in ("", None):
        fid = int(faculty_id)
        rows = _read_faculty_courses(fid, year)
        hits, total = filter_courses(rows, query, fid, limit)
        return {
            "akademskaGodina": year,
            "query": query,
            "faculty_id": fid,
            "count": len(hits),
            "total_matches": total,
            "courses": hits,
            "coverage": {"faculties_requested": [fid], "faculties_failed": [], "complete": True,
                         "scope": "one faculty; the full spine is not cached yet"},
            "from": "faculty",
        }
    spine = load_spine(year)
    hits, total = filter_courses(spine["courses"], query, None, limit)
    return {
        "akademskaGodina": year,
        "query": query,
        "faculty_id": None,
        "count": len(hits),
        "total_matches": total,
        "courses": hits,
        "coverage": spine.get("coverage"),
        "from": "spine",
    }


def course_detail(args):
    if args.get("faculty_id") in (None, "") or args.get("code") in (None, ""):
        return {"error": "faculty_id and code are required."}
    year = _year(args)
    fid = int(args["faculty_id"])
    record = _core.call_tool("unizg_course", {
        "faculty_id": fid,
        "code": str(args["code"]),
        "year": year,
        "enrich": False,
    })
    return shape_course(record, institution_by_id(fid))


def programmes(args):
    if args.get("faculty_id") in (None, ""):
        return {"error": "faculty_id is required."}
    year = _year(args)
    fid = int(args["faculty_id"])
    raw = _core.call_tool("unizg_programmes", {"faculty_id": fid, "year": year})
    if isinstance(raw, dict) and raw.get("error"):
        return raw
    out = []
    for block in raw.get("razine") or []:
        for study in block.get("studiji") or []:
            if not study.get("has_curriculum"):
                continue
            out.append({
                "razina": block.get("razina"),
                "izvedba": block.get("izvedba"),
                "smjer": study.get("smjer"),
                "naziv": study.get("naziv"),
                "kategorija": study.get("kategorija"),
                "semestara": study.get("semestara"),
            })
    institution = institution_by_id(fid)
    return {
        "faculty_id": fid,
        "fakultet": institution["kratko"],
        "akademskaGodina": year,
        "programmes": out,
    }


def stamp_programme(payload, institution):
    if not isinstance(payload, dict) or payload.get("error"):
        return payload
    courses = []
    for course in payload.get("kolegiji") or []:
        item = dict(course)
        item.pop("_paths", None)
        item["faculty_id"] = institution["id"]
        item["fakultet"] = institution["kratko"]
        code = str(item.get("sifra") or "").strip()
        if code:
            item["id"] = f"{institution['id']}:{code}"
        source = []
        for prereq in item.get("preduvjeti") or []:
            if isinstance(prereq, str):
                source.append({"kolegij": prereq, "uvjet": "polozen"})
                continue
            name = str(prereq.get("kolegij") or "").strip()
            if name:
                source.append({"kolegij": name, "uvjet": _norm_uvjet(prereq.get("uvjet"))})
        item["izvor_preduvjeti"] = source
        courses.append(item)
    out = dict(payload)
    out["kolegiji"] = courses
    out["faculty_id"] = institution["id"]
    out["fakultet"] = institution["kratko"]
    return out


def programme_dag(args):
    for key in ("faculty_id", "razina", "izvedba", "smjer"):
        if args.get(key) in (None, ""):
            return {"error": f"Missing {key}."}
    year = _year(args)
    fid = int(args["faculty_id"])
    raw = _core.call_tool("unizg_dag_json", {
        "faculty_id": fid,
        "razina": int(args["razina"]),
        "izvedba": str(args["izvedba"]),
        "smjer": int(args["smjer"]),
        "year": year,
    })
    return stamp_programme(raw, institution_by_id(fid))


def institutions_payload():
    institutions = [public_institution(inst) for inst in _core._institutions()]
    return {
        "count": len(institutions),
        "akademskaGodina": isvu.current_academic_year(),
        "institutions": institutions,
    }


def dispatch(args):
    op = (args.get("op") or "info").strip()
    if op == "info":
        return {
            "name": "unizg-catalog",
            "ops": ["institutions", "spine", "search", "course", "programmes", "dag"],
            "note": "Search spine only. Course pages are fetched by op=course. No dataset is shipped.",
        }
    if op == "institutions":
        return institutions_payload()
    if op == "spine":
        return load_spine(_year(args))
    if op == "search":
        return search(args)
    if op == "course":
        return course_detail(args)
    if op == "programmes":
        return programmes(args)
    if op == "dag":
        return programme_dag(args)
    return {"error": f"Unknown op {op!r}."}


def _cache_header(op):
    if op == "spine":
        return "public, s-maxage=21600, stale-while-revalidate=86400"
    if op == "search":
        return "public, s-maxage=3600, stale-while-revalidate=86400"
    if op in ("course", "programmes", "dag", "institutions"):
        return "public, s-maxage=86400, stale-while-revalidate=86400"
    return "public, max-age=300"


class handler(BaseHTTPRequestHandler):
    def _send(self, code, payload, cache=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        if cache and code == 200:
            self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def _args(self):
        qs = parse_qs(urlparse(self.path).query)
        return {key: values[-1] for key, values in qs.items() if values}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        args = self._args()
        op = (args.get("op") or "info").strip()
        try:
            payload = dispatch(args)
        except isvu.RateLimited as exc:
            return self._send(429, {"error": str(exc)})
        except Exception as exc:
            return self._send(500, {"error": f"{type(exc).__name__}: {exc}"})
        code = 400 if isinstance(payload, dict) and payload.get("error") else 200
        cache = _cache_header(op) if code == 200 else None
        self._send(code, payload, cache)

    def log_message(self, *args):
        pass
