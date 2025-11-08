from datetime import datetime, timezone
from typing import Any, Dict, List
from .models import Student, MessageItem, Conversation
import os
from openai import OpenAI
import re
import urllib.parse


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

# === Standard OpenAI SDK integration (Option A) ===

_openai_client: OpenAI | None = None

def _get_openai_client() -> OpenAI:
    """
    Lazily construct a singleton OpenAI client using the OPENAI_API_KEY
    environment variable. Raises a clear error if not configured.
    """
    global _openai_client
    if _openai_client is None:
        api_key = "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"
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set in environment")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


UNIZG_SYSTEM_PROMPT = """You are explore Unizg Assistant, a friendly guide for students on the explore Unizg website (University of Zagreb). Default language: Croatian. If the user writes in English, reply in English until they switch back. Tone: warm, brief, helpful, lightly suggestive, with occasional emojis. Goal: help users quickly find what they need: information about the University of Zagreb and its faculties, job openings and applications, job recommendations, student & networking events (career fairs, hackathons, workshops, meetups), and student organizations (with links to their profiles). No data storage or tools. Do not claim to save anything or perform background actions.
Behavior guidelines
Start with a short welcome (1–2 sentences) and offer quick options.
Ask up to 3 concise questions to tailor help (study field, job type, location, key skills).
Keep answers short: small paragraphs and bullet points (3–5 items).
When relevant, include a plain text action hint like [Izradi AI životopis] to suggest creating an AI CV (UI handled elsewhere).
If the user asks for profiles, provide clear links or slugs they can open on the site (e.g., faculty/employer/student org profiles).
If something isn’t available, say so briefly and suggest another path.
Never promise saving data, scheduling, or external calls.
Formatting: Use plain text only. Do NOT use Markdown bold or italics. Never output asterisks (*).
Links: Include at most one link only when essential; otherwise use short plain slugs (e.g., fer.unizg.hr) without markdown. Never add tracking parameters or query strings. Do not use markdown link syntax []().
You may use web search when helpful, but restrict sources to www.unizg.hr and szzg.unizg.hr.
Quick navigation labels (Croatian first):
🔍 Pregled poslova
🎟 Događaji ovog tjedna
🧑‍🎓 Studentske udruge
🏫 Fakulteti
🏢 Poslodavci
💡 Personalizirane preporuke (bez spremanja podataka)
Example first reply (Croatian): „Hej 👋 Dobrodošao na explore Unizg! Ovdje možeš pronaći poslove, događaje i studentske udruge te informacije o fakultetima i poslodavcima. Što želiš prvo? • 🔍 Pregled poslova • 🎟 Događaji ovog tjedna • 🧑‍🎓 Studentske udruge • 🏫 Fakulteti / 🏢 Poslodavci • 💡 Daj mi par informacija pa ću predložiti što bi ti moglo biti korisno (ne spremam ništa).“
Follow-up questions (ask only what’s needed):
„Koji studij ili smjer te zanima?“
„Tražiš praksu, studentski posao ili juniorsku full-time poziciju?“
„Koju lokaciju preferiraš (npr. Zagreb, remote)?“
„Koje vještine želiš istaknuti (npr. Python, marketing, dizajn)?“
If user switches to English, respond like this: “Hi! I can help you find jobs, events, and student organizations at the University of Zagreb. What would you like to explore first?”

Important: Never claim you can save data, schedule tasks, or perform background or external actions. If asked to do so, politely decline and proceed with guidance only."""


def _history_to_response_items(history: List[dict]) -> List[dict]:
    """
    Convert our stored conversation [{'role': 'user'|'agent', 'content': '...'}]
    to the Responses API item shape.
    """
    items: List[dict] = []
    for item in history or []:
        role = item.get("role")
        content = item.get("content", "")
        if not isinstance(content, str) or not content:
            continue
        mapped_role = "assistant" if role == "agent" else "user"
        items.append({
            "role": mapped_role,
            "content": [
                # Use output_text for assistant turns, input_text for user turns
                {"type": "output_text" if mapped_role == "assistant" else "input_text", "text": content}
            ],
        })
    return items


def _strip_query(url: str) -> str:
    try:
        parts = urllib.parse.urlsplit(url)
        # Drop all query parameters entirely for cleaner links
        return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", parts.fragment))
    except Exception:
        return url


def sanitize_assistant_text(text: str) -> str:
    """
    Post-process the model output:
      - remove bold markers (asterisks)
      - strip UTM params from URLs
      - limit to at most one clickable URL; replace extra URLs with their domain
    """
    if not isinstance(text, str):
        return ""
    # Remove all asterisks to avoid bold/italics markers
    sanitized = text.replace("*", "")

    url_pattern = r"https?://[^\s)]+"
    urls = re.findall(url_pattern, sanitized)
    if not urls:
        # Also normalize markdown-style links even if no URL regex was matched earlier
        pass

    first_url = urls[0] if urls else None

    def replace_url(match: re.Match) -> str:
        url = match.group(0)
        clean = _strip_query(url)
        if first_url and url == first_url:
            return clean
        netloc = urllib.parse.urlsplit(clean).netloc or "link"
        return netloc

    if urls:
        sanitized = re.sub(url_pattern, replace_url, sanitized)

    # Convert markdown links [text](url) to either the visible text (if looks like domain/slug)
    # or to the cleaned URL. This also helps remove leftover brackets/parentheses.
    md_link_pattern = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")

    def replace_md_link(m: re.Match) -> str:
        visible = m.group(1).strip()
        url = _strip_query(m.group(2))
        # If visible looks like a domain or slug, prefer it; else show the cleaned URL
        if re.match(r"^[\w.-]+(\.[\w.-]+)+(\/[\w./-]*)?$", visible):
            return visible
        return url

    sanitized = md_link_pattern.sub(replace_md_link, sanitized)
    return sanitized


def generate_unizg_reply(input_text: str, chat_history: List[dict]) -> str:
    """
    Call OpenAI Responses API with our system prompt and conversation context.
    Returns the assistant's text reply.
    """
    client = _get_openai_client()

    messages: List[dict] = [
        *_history_to_response_items(chat_history),
        {
            "role": "user",
            "content": [{"type": "input_text", "text": input_text}],
        },
    ]

    resp = client.responses.create(
        model="gpt-4.1",
        input=messages,
        instructions=UNIZG_SYSTEM_PROMPT,
        tools=[{"type": "web_search"}],
    )
    raw = resp.output_text or ""
    return sanitize_assistant_text(raw)


