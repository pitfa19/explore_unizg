from django.shortcuts import render
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json
from datetime import datetime, timezone
from typing import Optional
from .models import Student, MessageItem, Conversation

@csrf_exempt
@require_POST
def process_message(request: HttpRequest):
    try:
        payload = json.loads((request.body or b"").decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    text: Optional[str] = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return JsonResponse({"error": "Field 'text' is required"}, status=400)

    # Resolve student (create if not provided)
    student_id = payload.get("student_id")
    if student_id is not None:
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse({"error": "Invalid student_id"}, status=404)
    else:
        student = Student.objects.create(name="anonymous")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Validate incoming user message via Pydantic
    try:
        user_msg = MessageItem(role="user", content=text.strip(), created_at=now_iso)
    except Exception as e:
        return JsonResponse({"error": f"Invalid message: {e}"}, status=400)

    # Append message to student's conversation
    messages = list(student.messages or [])
    messages.append(user_msg.model_dump(mode="json"))

    # Stub agent reply
    agent_reply = ""
    agent_msg = MessageItem(role="agent", content=agent_reply, created_at=now_iso)
    messages.append(agent_msg.model_dump(mode="json"))

    # Validate full conversation
    try:
        Conversation.model_validate(messages)
    except Exception as e:
        return JsonResponse({"error": f"Invalid conversation: {e}"}, status=400)

    student.messages = messages
    student.full_clean()
    student.save(update_fields=["messages"])

    return JsonResponse({"answer": agent_reply, "student_id": student.id})
