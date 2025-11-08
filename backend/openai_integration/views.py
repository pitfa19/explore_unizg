from django.shortcuts import render
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods
import json
from datetime import datetime, timezone
from typing import Optional
from .models import Student, MessageItem, Conversation
from .utils import append_message_and_build_payload, generate_unizg_reply, generate_text_embedding
from graph_integration.models import Faculty, Organisation
import numpy as np
import re

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def process_message(request: HttpRequest):
    def _add_cors_headers(response: JsonResponse) -> JsonResponse:
        origin = request.headers.get("Origin") or "*"
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        acrh = request.headers.get("Access-Control-Request-Headers") or "Content-Type, Authorization"
        response["Access-Control-Allow-Headers"] = acrh
        response["Access-Control-Max-Age"] = "86400"
        return response

    if request.method == "OPTIONS":
        return _add_cors_headers(JsonResponse({}))

    try:
        payload = json.loads((request.body or b"").decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return _add_cors_headers(JsonResponse({"error": "Invalid JSON"}, status=400))

    text: Optional[str] = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return _add_cors_headers(JsonResponse({"error": "Field 'text' is required"}, status=400))

    # Resolve student (create if not provided)
    student_id = payload.get("student_id")
    if student_id is not None:
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return _add_cors_headers(JsonResponse({"error": "Invalid student_id"}, status=404))
    else:
        student = Student.objects.create(name="anonymous")

    try:
        payload = append_message_and_build_payload(student, text.strip())
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Invalid message or history: {e}"}, status=400))

    now_iso = datetime.now(timezone.utc).isoformat()
    messages = list(student.messages or [])

    # Generate real assistant reply via OpenAI Responses API
    try:
        agent_reply = generate_unizg_reply(payload["input_as_text"], payload["chat_history"]).strip() or "..."
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Assistant error: {e}"}, status=500))
    try:
        agent_msg = MessageItem(role="agent", content=agent_reply, created_at=now_iso)
        messages.append(agent_msg.model_dump(mode="json"))
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Invalid agent reply: {e}"}, status=500))

    # Validate full conversation
    try:
        Conversation.model_validate(messages)
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Invalid conversation: {e}"}, status=400))

    student.messages = messages
    try:
        student.full_clean()
        student.save(update_fields=["messages"])
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Failed to save message: {e}"}, status=500))

    return _add_cors_headers(JsonResponse({"answer": agent_reply, "student_id": student.id}))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def embed_student_and_knn(request: HttpRequest):
    def _add_cors_headers(response: JsonResponse) -> JsonResponse:
        origin = request.headers.get("Origin") or "*"
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        acrh = request.headers.get("Access-Control-Request-Headers") or "Content-Type, Authorization"
        response["Access-Control-Allow-Headers"] = acrh
        response["Access-Control-Max-Age"] = "86400"
        return response

    if request.method == "OPTIONS":
        return _add_cors_headers(JsonResponse({}))

    try:
        payload = json.loads((request.body or b"").decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return _add_cors_headers(JsonResponse({"error": "Invalid JSON"}, status=400))

    # Accept either student_id or name for flexibility
    student = None
    student_id = payload.get("student_id")
    if student_id is not None:
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return _add_cors_headers(JsonResponse({"error": "Invalid student_id"}, status=404))
    else:
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            return _add_cors_headers(JsonResponse({"error": "Field 'name' is required"}, status=400))
        try:
            student = Student.objects.get(name=name.strip())
        except Student.DoesNotExist:
            return _add_cors_headers(JsonResponse({"error": "Student not found"}, status=404))

    hist = list(student.messages or [])
    if not hist:
        return _add_cors_headers(JsonResponse({"error": "No messages for this student"}, status=400))

    # Concatenate message contents in order
    parts = []
    for item in hist:
        content = (item or {}).get("content") or ""
        if isinstance(content, str) and content.strip():
            parts.append(content.strip())
    full_text = "\n\n".join(parts).strip()
    if not full_text:
        return _add_cors_headers(JsonResponse({"error": "No textual content to embed"}, status=400))

    # Generate and save embedding for the student
    try:
        embedding = generate_text_embedding(full_text)
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Embedding error: {e}"}, status=500))
    student.embedding = embedding
    try:
        student.full_clean()
        student.save(update_fields=["embedding"])
    except Exception as e:
        return _add_cors_headers(JsonResponse({"error": f"Failed to save embedding: {e}"}, status=500))

    # Prepare neighbor search across faculties and organisations (cosine on L2-normalized vectors)
    def _l2_norm(vec: np.ndarray) -> np.ndarray:
        n = np.linalg.norm(vec)
        if n == 0.0:
            return vec
        return vec / n

    query = _l2_norm(np.asarray(embedding, dtype=float))

    items = []
    # Faculties
    for f in Faculty.objects.exclude(embedding__isnull=True):
        emb = f.embedding or []
        if not isinstance(emb, list) or not emb:
            continue
        vec = _l2_norm(np.asarray(emb, dtype=float))
        sim = float(np.dot(query, vec))
        dist = float(1.0 - sim)
        # Match graph node id/label: cleaned faculty name (strip trailing " (UNIZG)")
        raw_name = (f.name or "").strip()
        label = re.sub(r"\s*\(UNIZG\)\s*$", "", raw_name)
        items.append({
            "type": "faculty",
            "id": f.id,
            "label": label,
            "name": raw_name,
            "abbreviation": (f.abbreviation or "").strip(),
            "distance": dist,
        })
    # Organisations
    for o in Organisation.objects.exclude(embedding__isnull=True):
        emb = o.embedding or []
        if not isinstance(emb, list) or not emb:
            continue
        vec = _l2_norm(np.asarray(emb, dtype=float))
        sim = float(np.dot(query, vec))
        dist = float(1.0 - sim)
        items.append({
            "type": "organisation",
            "id": o.id,
            "label": (o.name or "").strip(),
            "name": (o.name or "").strip(),
            "abbreviation": (o.abbreviation or "").strip(),
            "distance": dist,
        })

    items_sorted = sorted(items, key=lambda x: x["distance"])
    top_k = items_sorted[:3]

    return _add_cors_headers(JsonResponse({
        "student_id": student.id,
        "name": student.name,
        "neighbors": top_k,
    }))
