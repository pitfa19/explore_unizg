from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

from .models import Faculty


def _add_cors_headers(request: HttpRequest, response: JsonResponse) -> JsonResponse:
    origin = request.headers.get("Origin") or "*"
    response["Access-Control-Allow-Origin"] = origin
    response["Vary"] = "Origin"
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
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
