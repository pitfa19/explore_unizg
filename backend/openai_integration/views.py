from django.shortcuts import render
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods
import json
from datetime import datetime, timezone
from typing import Optional
from .models import Student, MessageItem, Conversation
from .utils import append_message_and_build_payload

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

    # Stub agent reply
    agent_reply = "..."
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
