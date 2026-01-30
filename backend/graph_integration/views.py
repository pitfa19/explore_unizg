from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import re

from .models import Faculty, Organisation
from openai_integration.models import Student
from django.utils.html import strip_tags


def _add_cors_headers(request: HttpRequest, response: JsonResponse) -> JsonResponse:
    origin = request.headers.get("Origin") or "*"
    response["Access-Control-Allow-Origin"] = origin
    response["Vary"] = "Origin"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    acrh = request.headers.get("Access-Control-Request-Headers") or "Content-Type, Authorization"
    response["Access-Control-Allow-Headers"] = acrh
    response["Access-Control-Max-Age"] = "86400"
    return response


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def upsert_faculty(request: HttpRequest):
    if request.method == "OPTIONS":
        return _add_cors_headers(request, JsonResponse({}))

    try:
        payload = json.loads((request.body or b"").decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return _add_cors_headers(request, JsonResponse({"error": "Invalid JSON"}, status=400))

    # Expected payload keys from unizg_faculties.json and optional embedding
    name = (payload.get("Name") or "").strip()
    abbreviation = (payload.get("Abbreviation") or "").strip()
    if not abbreviation:
        return _add_cors_headers(request, JsonResponse({"error": "Abbreviation is required"}, status=400))

    defaults = {
        "name": name,
        "domain_areas": (payload.get("Domain areas") or "").strip(),
        "programs": (payload.get("Programs") or "").strip(),
        "research_topics": (payload.get("Research topics") or "").strip(),
        "methods_and_tech": (payload.get("Methods & tech") or "").strip(),
        "affiliations_and_labs": (payload.get("Affiliations & labs") or "").strip(),
        "typical_outputs": (payload.get("Typical outputs") or "").strip(),
        "keywords": (payload.get("Keywords") or "").strip(),
        "url": (payload.get("URL") or "").strip(),
    }

    obj, created = Faculty.objects.get_or_create(abbreviation=abbreviation, defaults=defaults)
    if not created:
        changed = False
        for field, value in defaults.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True
        if changed:
            obj.save()

    # Optional embedding assignment
    if "embedding" in payload:
        obj.embedding = payload.get("embedding")
        obj.save(update_fields=["embedding"])

    return _add_cors_headers(
        request,
        JsonResponse(
            {
                "id": obj.id,
                "created": created,
                "abbreviation": obj.abbreviation,
                "has_embedding": obj.embedding is not None,
            }
        ),
    )
from django.shortcuts import render

# Create your views here.


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def list_faculty_edges(request: HttpRequest):
    if request.method == "OPTIONS":
        return _add_cors_headers(request, JsonResponse({}))

    # Faculties: id = cleaned full name (label), keep abbreviation in data
    faculties = list(Faculty.objects.all())
    def _clean_name(text: str) -> str:
        return re.sub(r"\s*\(UNIZG\)\s*$", "", (text or "").strip())
    fac_abbr_to_label = { (f.abbreviation or "").strip(): _clean_name(f.name) for f in faculties if (f.abbreviation or "").strip() }
    faculty_nodes = [
        {
            "id": fac_abbr_to_label.get(abbr, abbr),
            "label": fac_abbr_to_label.get(abbr, abbr),
            "type": "faculty",
            "cluster": f.cluster,
            "data": {"abbreviation": abbr, "url": (f.url or "").strip()},
        }
        for f in faculties
        for abbr in [(f.abbreviation or "").strip()]
        if abbr
    ]
    faculty_edges = []
    for f in faculties:
        src_label = _clean_name(f.name)
        if not src_label:
            continue
        for e in (f.knn_edges or []):
            dst_label = (e.get("neighbor_label") or "").strip()
            if not dst_label:
                # Backward compatibility: map neighbor_abbreviation to label if present
                abbr = (e.get("neighbor_abbreviation") or "").strip()
                if abbr:
                    dst_label = fac_abbr_to_label.get(abbr, abbr)
            if not dst_label:
                continue
            faculty_edges.append(
                {"from": src_label, "to": dst_label, "distance": float(e.get("distance") or 0.0)}
            )

    # Organisations: id = full name, label = full name
    orgs = list(Organisation.objects.all())
    def _org_id(o: Organisation) -> str:
        name = (o.name or "").strip()
        return name
    org_id_to_label = { _org_id(o): (o.name or "").strip() for o in orgs if _org_id(o) }
    org_nodes = [
        {
            "id": _org_id(o),
            "label": (o.name or "").strip(),
            "type": "organisation",
            "cluster": o.cluster,
            "data": {"abbreviation": (o.abbreviation or "").strip(), "url": (o.url or "").strip()},
        }
        for o in orgs
        if _org_id(o)
    ]
    org_edges = []
    for o in orgs:
        src_label = _org_id(o)
        if not src_label:
            continue
        for e in (o.knn_edges or []):
            dst_label = (e.get("neighbor_label") or "").strip()
            if not dst_label:
                continue
            org_edges.append(
                {"from": src_label, "to": dst_label, "distance": float(e.get("distance") or 0.0)}
            )

    nodes = faculty_nodes + org_nodes
    edges = faculty_edges + org_edges
    return _add_cors_headers(request, JsonResponse({"nodes": nodes, "edges": edges}))


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def get_faculty(request: HttpRequest):
    if request.method == "OPTIONS":
        return _add_cors_headers(request, JsonResponse({}))

    # Support lookup by cleaned full name (preferred) or fallback to abbreviation
    raw_name = (request.GET.get("name") or "").strip()
    abbr = (request.GET.get("abbreviation") or "").strip()

    faculty = None
    if raw_name:
        def _clean_name(text: str) -> str:
            return re.sub(r"\s*\(UNIZG\)\s*$", "", (text or "").strip())
        cleaned = _clean_name(raw_name)
        # Find first faculty whose cleaned name matches provided cleaned name
        for f in Faculty.objects.all():
            if _clean_name(f.name) == cleaned:
                faculty = f
                break
    elif abbr:
        try:
            faculty = Faculty.objects.get(abbreviation=abbr)
        except Faculty.DoesNotExist:
            faculty = None

    if faculty is None:
        return _add_cors_headers(request, JsonResponse({"error": "Faculty not found"}, status=404))

    clean_name = re.sub(r"\s*\(UNIZG\)\s*$", "", (faculty.name or "").strip())
    # Direct KNN edges of the faculty
    edges = []
    direct_neighbor_labels = []
    for e in (faculty.knn_edges or []):
        # Prefer label; fallback for backward compatibility
        dst_label = (e.get("neighbor_label") or "").strip()
        if not dst_label:
            dst_label = (e.get("neighbor_abbreviation") or "").strip()
        if not dst_label:
            continue
        edges.append({"to": dst_label, "distance": float(e.get("distance") or 0.0)})
        direct_neighbor_labels.append(dst_label)

    # Build lookup maps to resolve labels <-> faculties
    def _clean_name_local(text: str) -> str:
        return re.sub(r"\s*\(UNIZG\)\s*$", "", (text or "").strip())
    all_faculties = list(Faculty.objects.all())
    label_to_faculty = {}
    for f in all_faculties:
        lbl = _clean_name_local(f.name)
        if lbl:
            label_to_faculty[lbl] = f

    # Collect KNN edges of the neighbors (second-degree edges)
    neighbor_knn_edges = []
    second_degree_labels = []
    for neigh_label in direct_neighbor_labels:
        neigh_fac = label_to_faculty.get(neigh_label)
        if not neigh_fac:
            continue
        for e in (neigh_fac.knn_edges or []):
            dst_label = (e.get("neighbor_label") or "").strip()
            if not dst_label:
                dst_label = (e.get("neighbor_abbreviation") or "").strip()
            if not dst_label:
                continue
            neighbor_knn_edges.append({
                "from": neigh_label,
                "to": dst_label,
                "distance": float(e.get("distance") or 0.0),
            })
            second_degree_labels.append(dst_label)

    # Build a concise list of related faculties (union of direct + second-degree)
    related_faculty_labels = []
    seen_labels = set()
    for lbl in direct_neighbor_labels + second_degree_labels:
        if lbl and lbl not in seen_labels and lbl != clean_name:
            related_faculty_labels.append(lbl)
            seen_labels.add(lbl)
    faculties_list = []
    for lbl in related_faculty_labels:
        fac = label_to_faculty.get(lbl)
        faculties_list.append({
            "label": lbl,
            "abbreviation": (fac.abbreviation if fac else "") or "",
            "cluster": (fac.cluster if fac else None),
            "url": ((fac.url or "").strip() if fac else ""),
        })

    # Related organisations: organisations that reference this faculty or any direct neighbor by label
    anchor_labels = set([clean_name] + direct_neighbor_labels)
    orgs = list(Organisation.objects.all())
    organisations_list = []
    for o in orgs:
        min_dist = None
        matched = False
        for e in (o.knn_edges or []):
            dst_label = (e.get("neighbor_label") or "").strip()
            if not dst_label:
                continue
            if dst_label in anchor_labels:
                matched = True
                try:
                    d = float(e.get("distance") or 0.0)
                except Exception:
                    d = 0.0
                if (min_dist is None) or (d < min_dist):
                    min_dist = d
        if matched:
            organisations_list.append({
                "name": (o.name or "").strip(),
                "abbreviation": (o.abbreviation or "").strip(),
                "cluster": o.cluster,
                "distance": min_dist if min_dist is not None else 0.0,
                "url": (o.url or "").strip(),
            })

    return _add_cors_headers(
        request,
        JsonResponse(
            {
                "abbreviation": faculty.abbreviation,
                "name": clean_name,
                "cluster": faculty.cluster,
                "url": (faculty.url or "").strip(),
                # Basic descriptive fields
                "domain_areas": (faculty.domain_areas or "").strip(),
                "programs": (faculty.programs or "").strip(),
                "research_topics": (faculty.research_topics or "").strip(),
                "methods_and_tech": (faculty.methods_and_tech or "").strip(),
                "affiliations_and_labs": (faculty.affiliations_and_labs or "").strip(),
                "typical_outputs": (faculty.typical_outputs or "").strip(),
                "keywords": (faculty.keywords or "").strip(),
                # Backward compatible: keep "edges" as direct KNN edges
                "edges": edges,
                # New fields:
                "knn_edges": edges,
                "neighbor_knn_edges": neighbor_knn_edges,
                "faculties": faculties_list,
                "organisations": organisations_list,
            }
        ),
    )


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def get_organisation(request: HttpRequest):
    if request.method == "OPTIONS":
        return _add_cors_headers(request, JsonResponse({}))

    raw_name = (request.GET.get("name") or "").strip()
    if not raw_name:
        return _add_cors_headers(request, JsonResponse({"error": "Missing name"}, status=400))

    try:
        org = Organisation.objects.get(name=raw_name)
    except Organisation.DoesNotExist:
        return _add_cors_headers(request, JsonResponse({"error": "Organisation not found"}, status=404))

    return _add_cors_headers(
        request,
        JsonResponse(
            {
                "name": (org.name or "").strip(),
                "abbreviation": (org.abbreviation or "").strip(),
                "url": (org.url or "").strip(),
                "scope": (org.scope or "").strip(),
                "mission": (org.mission or "").strip(),
                "domains": list(org.domains or []),
                "core_activities": list(org.core_activities or []),
                "flagship_projects": list(org.flagship_projects or []),
                "target_members": (org.target_members or "").strip(),
                "affiliations": list(org.affiliations or []),
                "partnerships": (org.partnerships or None),
                "skills_outcomes": list(org.skills_outcomes or []),
                "keywords": list(org.keywords or []),
                "cluster": org.cluster,
            }
        ),
    )

@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def info(request: HttpRequest):
    if request.method == "OPTIONS":
        return _add_cors_headers(request, JsonResponse({}))
    return _add_cors_headers(
        request,
        JsonResponse(
            {
                "faculties_count": Faculty.objects.count(),
                "organisations_count": Organisation.objects.count(),
                "students_count": Student.objects.count(),
            }
        ),
    )
