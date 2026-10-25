"""Conservative official-faculty source directory and optional HTML enrichment.

No network policy or transport lives here: callers inject fetch(url) -> HTML text.
Formal ISVU prerequisite lists are never modified. A missing source is unknown,
not evidence that a course has no prerequisites or learning outcomes.
"""
from copy import deepcopy
from datetime import date
from html.parser import HTMLParser
import re
import unicodedata
from urllib.parse import urljoin, urlparse

CHECKED = "2026-10-25"
FER = "https://www.fer.unizg.hr"
FER_ROOT = FER + "/studiji/diplomski_studiji"
# Snapshot only, not an authoritative replacement for live ISVU enumeration.
INSTITUTION_IDS = (6, 7, 13, 15, 16, 34, 36, 37, 53, 54, 58, 65, 66, 67,
                   68, 82, 108, 117, 119, 120, 124, 125, 128, 130, 131,
                   135, 160, 178, 195, 203, 251, 381, 1003, 1053, 1349,
                   2223, 2225, 9950, 9996)


def _source(ids, kind, url, coverage, year, retrieval="directory_only", fields=()):
    return dict(faculty_ids=list(ids), kind=kind, url=url, status="verified",
                coverage=coverage, academic_year_handling=year, checked_date=CHECKED,
                retrieval=retrieval, supported_fields=list(fields), pdf_text_extraction=False)


SOURCES = [
    _source([36], "course", FER_ROOT,
            "Bounded official programme-catalogue discovery, then code and title verified course HTML; not exhaustive",
            "Only the HTML selected academic year is supported; historical JS switching is not implemented",
            "html_enrichment", ("opis", "ishodi_ucenja", "recommended_background")),
    _source([16], "course", "https://nastava.foi.hr/course/{code}/{year}-{next_year}",
            "Code-addressed course HTML, exact title and displayed year checked",
            "Explicit starting year in URL; displayed year must agree", "html_enrichment",
            ("opis", "ishodi_ucenja", "prerequisite_statement", "syllabus")),
    _source([37], "course", "https://www.pmf.unizg.hr/math/studenti/nastava",
            "Mathematics teaching directory links course list, annual study-plan PDF and calendars; no automated enrichment",
            "Directory labels 2026/2027 and links historical study plans; verify each document year"),
    _source([119], "course", "https://www.pmf.unizg.hr/chem/predmet/bio1_b",
            "Verified chemistry example only; other natural-science departments remain unmapped, no automated enrichment",
            "Inspect the page year manually, no historical resolver"),
    _source([58], "course", "https://www.pbf.unizg.hr/predmet/bio1_g",
            "Verified Biokemija 1 example only; no automated enrichment or exhaustive catalogue mapping",
            "Inspect page year manually"),
    _source([66], "programme_outcomes", "https://www.pravo.unizg.hr/studiji/izvedbeni-planovi-ishodi-ucenja/",
            "Official directory locates outcome documents; PDF contents are not extracted",
            "Read each linked document's year, not the directory update date"),
    _source([117], "english_courses", "https://www.ttf.unizg.hr/en/study-courses-in-english/730",
            "Official English-offering list located, not joined to ISVU records",
            "List labeled 2026/2027 at check; later offerings must be verified"),
    _source([9996], "english_courses", "https://www.unizg.hr/homepage/study-at-the-university-of-zagreb/degrees-studies-and-courses/studies-and-courses-in-english/",
            "Faculty source-link directory, not a complete or current-year offering database",
            "Check year and availability of each linked faculty list"),
    _source([9996], "calendar", "https://www.unizg.hr/studiji-i-studiranje/studiji/nastava/",
            "Annual academic-calendar directory only; no timetable-event extraction",
            "Select the annual document explicitly"),
    _source([16], "mobility", "https://www.foi.unizg.hr/hr/horizontalna-mobilnost",
            "Procedure/forms/course-catalogue landing page; no form submission",
            "Linked English catalogue was 2025/2026 at check; verify attachments separately"),
    _source([16], "timetable", "https://nastava.foi.hr/student-schedule",
            "Entry point located; no timetable-event extraction", "Dynamic schedule year not resolved"),
]


def sources_for(faculty_id=None, kind=None):
    """JSON-serializable routes; unknown IDs and kinds never imply absence."""
    fid = int(faculty_id) if faculty_id is not None else None
    rows = [deepcopy(s) for s in SOURCES if (fid is None or fid in s["faculty_ids"])
            and (kind is None or s["kind"] == kind)]
    mapped = {i for s in rows for i in s["faculty_ids"]}
    return {"faculty_id": fid, "kind": kind, "status": "partial" if rows else "unknown",
            "sources": rows, "checked_date": CHECKED,
            "unmapped_faculty_ids": [i for i in INSTITUTION_IDS if i not in mapped] if fid is None else ([fid] if not rows else []),
            "coverage_note": "Verified means the route was checked, not comprehensive institution coverage. Unlisted routes and fields are unknown. PDF text and timetable events are not extracted."}


def _fold(text):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD", text or "")
                            if not unicodedata.combining(c)).casefold().split())


class _HTML(HTMLParser):
    """Tiny structural reader, keeping text spans and link/heading metadata."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.parts, self.nodes, self.stack = [], [], []
        self.skip = 0
        self.feed(html)
        self.close()
        for node in self.stack:
            node["end"] = len(self.parts)

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if self.skip:
            return
        attrs = dict(attrs)
        if tag in ("div", "p", "li", "br", "td", "h1", "h2", "h3", "h4", "h5", "option"):
            self.parts.append("\n")
        node = dict(tag=tag, attrs=attrs, start=len(self.parts), end=None)
        self.nodes.append(node)
        if tag not in ("meta", "link", "img", "br", "hr", "input", "source", "wbr"):
            self.stack.append(node)
        else:
            node["end"] = len(self.parts)

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                for node in self.stack[i:]:
                    node["end"] = len(self.parts)
                del self.stack[i:]
                break
        if tag in ("div", "p", "li", "td", "h1", "h2", "h3", "h4", "h5", "option"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def text(self, node=None):
        parts = self.parts if node is None else self.parts[node["start"]:node["end"]]
        return " ".join(" ".join(parts).split())

    def section(self, label):
        headings = [n for n in self.nodes if n["tag"] in ("h1", "h2", "h3", "h4", "h5", "h6", "v-expansion-panel-header")
                    or "foi-label" in n["attrs"].get("class", "").split()]
        for i, node in enumerate(headings):
            if _fold(self.text(node)) == _fold(label):
                end = headings[i + 1]["start"] if i + 1 < len(headings) else len(self.parts)
                start = node["end"]
                items = [self.text(n) for n in self.nodes if n["tag"] == "li" and start <= n["start"] < end]
                return " ".join(" ".join(self.parts[start:end]).split()), items
        return "", []

    def links(self):
        return [(n["attrs"].get("href", ""), self.text(n)) for n in self.nodes if n["tag"] == "a"]


def _fer_page(record, fetch):
    # Discover actual official course paths, never guess a slug from a title.
    queue = [FER_ROOT, FER + "/studiji/fer3/racunarstvo", FER + "/studiji/fer3/eit"]
    seen, candidates, failures = set(), set(), []
    title = _fold(record.get("naziv"))
    for _ in range(32):
        if not queue:
            break
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            page = _HTML(fetch(url))
        except Exception as exc:
            if getattr(exc, "stop_fetching", False):
                raise
            failures.append(type(exc).__name__)
            continue
        for href, label in page.links():
            target = urljoin(url, href)
            parsed = urlparse(target)
            if parsed.scheme != "https" or parsed.netloc != "www.fer.unizg.hr" or parsed.query or parsed.fragment:
                continue
            if re.fullmatch(r"/predmet/[A-Za-z0-9_-]+", parsed.path) and _fold(label) == title:
                if target in candidates:
                    continue
                candidates.add(target)
                candidate = _HTML(fetch(target))
                # Explicit language-labelled ISVU code, not an unrelated number anywhere in HTML.
                codes = re.findall(r"\b(?:HR|EN)\s+(\d+)\b", candidate.text())
                if str(record["sifra"]) in codes:
                    return target, candidate
            elif re.fullmatch(r"/studiji/dipl/(?:rac|eit|ikt)(?:/[A-Za-z0-9_]+)?", parsed.path):
                if target not in seen and target not in queue:
                    queue.append(target)
    reason = "FER catalogue discovery did not verify the course code and title; coverage is bounded, not absence"
    if failures:
        reason += " (catalogue fetch failures: " + ", ".join(sorted(set(failures))) + ")"
    raise ValueError(reason)


def enrich_course(record, fetch):
    """Return an enriched copy, preserving all original ISVU evidence on failure.

    Input is the core's faculty_id/sifra/naziv/akademskaGodina record (institution
    is accepted for CLI records). fetch accepts absolute URLs and returns HTML.
    Additions carry source URL, requested/displayed year, matching evidence and
    warnings. No unverified field absence is converted to an empty prerequisite.
    """
    result = deepcopy(record)
    result.setdefault("source_warnings", [])
    result.setdefault("sources", [])
    result["source_enrichment"] = {"status": "unknown", "sources": [], "fields": []}
    fid = record.get("faculty_id", record.get("institution"))
    if str(fid) not in ("16", "36"):
        result["source_warnings"].append("Faculty HTML enrichment is unmapped or unsupported; missing information remains unknown.")
        return result
    try:
        year = int(record["akademskaGodina"])
        code = str(record["sifra"])
        if not code.isdigit() or not record.get("naziv"):
            raise ValueError("Course identity requires a numeric code and nonempty title")
        if str(fid) == "16":
            url = f"https://nastava.foi.hr/course/{code}/{year}-{year + 1}"
            page = _HTML(fetch(url))
            titles = [page.text(n) for n in page.nodes if "text-h6" in n["attrs"].get("class", "").split()]
            if _fold(record["naziv"]) not in [_fold(t) for t in titles]:
                raise ValueError("FOI course title does not match requested code-addressed course")
            subtitles = [page.text(n) for n in page.nodes if "text-subtitle-1" in n["attrs"].get("class", "").split()]
            years = re.findall(r"\b(\d{4})\s*/\s*(\d{4})\b", " ".join(subtitles))
            if (str(year), str(year + 1)) not in years:
                raise ValueError("FOI displayed academic year does not match requested year")
            description, _ = page.section("Cilj kolegija")
            _, outcomes = page.section("Ishodi učenja kolegija")
            prerequisites, _ = page.section("Preduvjeti")
            syllabus, _ = page.section("Sadržaj predavanja")
            fields = {"opis": description, "ishodi_ucenja": outcomes, "syllabus": syllabus}
            if prerequisites:
                fields["prerequisite_statement"] = {"text": prerequisites,
                    "status": "explicit_none" if _fold(prerequisites).rstrip(".") == "kolegij nema definirane preduvjete" else "published_text",
                    "source": url, "academic_year": year,
                    "note": "Faculty statement, not a replacement for ISVU formal prerequisite lists."}
                if fields["prerequisite_statement"]["status"] == "explicit_none" and (record.get("preduvjeti_upis") or record.get("preduvjeti_polaganje")):
                    result["source_warnings"].append("Faculty states no defined prerequisites but ISVU has formal prerequisite entries; both sources are preserved, eligibility is unresolved.")
            else:
                result["source_warnings"].append("FOI prerequisite section was not found; requirements remain unknown.")
            identity = "code-addressed official route and exact normalized title"
        else:
            url, page = _fer_page(record, fetch)
            year_controls = [n for n in page.nodes if n["tag"] == "select"
                             and "selectyear" in n["attrs"].get("class", "").split()]
            selected = [n["attrs"].get("value") for n in page.nodes
                        if n["tag"] == "option" and "selected" in n["attrs"]
                        and any(c["start"] <= n["start"] < c["end"] for c in year_controls)]
            if selected != [str(year)]:
                raise ValueError("FER displayed academic year does not match requested year; historical JS switching unsupported")
            description, _ = page.section("Opis kolegija")
            _, outcomes = page.section("Ishodi učenja")
            background, _ = page.section("Preduvjeti")
            fields = {"opis": description, "ishodi_ucenja": outcomes}
            if background and "predznanj" in _fold(background):
                fields["recommended_background"] = background
                fields["preporuceno_predznanje"] = background
            elif background:
                fields["prerequisite_statement"] = {"text": background, "status": "published_text",
                    "source": url, "academic_year": year,
                    "note": "Unclassified faculty prerequisite text, not converted into formal ISVU prerequisites."}
            else:
                result["source_warnings"].append("FER prerequisite/background section was not found; requirements remain unknown.")
            identity = "official catalogue exact normalized title and course-page language-labelled ISVU code"
        supplied = []
        for key, value in fields.items():
            if value:
                if not result.get(key):
                    result[key] = value
                    if key == "opis":
                        result["opis_source"] = url
                    supplied.append(key)
            else:
                result["source_warnings"].append(f"{key} was not found in the matched faculty source; absence remains unknown.")
        result["source_enrichment"] = {"status": "verified", "fields": supplied,
            "sources": [{"url": url, "kind": "course", "status": "verified", "checked_date": date.today().isoformat(),
                         "requested_academic_year": year, "displayed_academic_year": year,
                         "identity_match": identity, "fields": supplied,
                         "academic_year_handling": "Requested year must match the explicit course-page year",
                         "coverage": "Matched course HTML only, not an exhaustive faculty crawl"}]}
        result["sources"].extend(deepcopy(result["source_enrichment"]["sources"]))
        if not supplied:
            result["source_warnings"].append("Matched faculty source supplied no additional fields.")
    except Exception as exc:
        if getattr(exc, "stop_fetching", False):
            raise
        # Ordinary adapter failures must not make the existing ISVU course unavailable.
        result["source_warnings"].append(f"Faculty source unavailable or unverified ({type(exc).__name__}): {exc}")
    return result
