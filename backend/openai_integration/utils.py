from datetime import datetime, timezone
from typing import Any, Dict, List
from .models import Student, MessageItem, Conversation


def append_message_and_build_payload(student: Student, text: str) -> Dict[str, Any]:
    """
    Append the new user message to the student's conversation and
    return a payload for the agent with:
      - input_as_text: the new message text
      - chat_history: prior messages (simple shape)
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must be a non-empty string")

    # prior history (simple shape) – exclude the new message
    prior_history: List[dict] = list(student.messages or [])

    # validate existing history
    Conversation.model_validate(prior_history)

    now_iso = datetime.now(timezone.utc).isoformat()
    user_msg = MessageItem(role="user", content=text.strip(), created_at=now_iso)

    # append + validate + persist
    updated_messages = prior_history + [user_msg.model_dump(mode="json")]
    Conversation.model_validate(updated_messages)

    student.messages = updated_messages
    student.full_clean()
    student.save(update_fields=["messages"])

    return {
        "input_as_text": text,
        "chat_history": prior_history,
    }
