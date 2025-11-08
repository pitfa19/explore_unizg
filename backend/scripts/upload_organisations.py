import os
import sys
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple
from dotenv import load_dotenv

# Ensure project root and backend are importable
PROJECT_ROOT = Path("/home/pitfa/Documents/explore_unizg").resolve()
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Django setup
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

import django  # noqa: E402
from django.apps import apps as django_apps  # noqa: E402

if not django_apps.ready:
    django.setup()

from graph_integration.models import Organisation  # noqa: E402

try:
    from openai import OpenAI  # noqa: E402
except Exception as e:  # pragma: no cover
    raise RuntimeError("OpenAI SDK not installed. Please install with `pip install openai`.") from e


# Load environment from backend/.env if present
load_dotenv(str(Path(__file__).resolve().parents[1] / ".env"))

# Keep consistent with existing scripts' style; read key from env
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY environment variable is not set. Export it before running this script."
    )

DATA_PATH = Path("/home/pitfa/Documents/explore_unizg/udruge.json")
EMBED_MODEL = "text-embedding-3-small"
BATCH_SIZE = 64

client = OpenAI(api_key=OPENAI_API_KEY)


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        # Join elements as strings, ignoring empties
        return "; ".join([str(x) for x in value if str(x).strip()])
    if isinstance(value, (dict,)):
        # Compact JSON form for dictionaries
        try:
            return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            return str(value)
    return str(value)


def build_org_text(record: Dict[str, Any]) -> str:
    parts: List[str] = []
    # Preserve labels similar to faculties script
    field_order = [
        ("name", "Name"),
        ("abbreviation", "Abbreviation"),
        ("scope", "Scope"),
        ("mission", "Mission"),
        ("domains", "Domains"),
        ("core_activities", "Core activities"),
        ("flagship_projects", "Flagship projects"),
        ("target_members", "Target members"),
        ("affiliations", "Affiliations"),
        ("partnerships", "Partnerships"),
        ("skills_outcomes", "Skills outcomes"),
        ("keywords", "Keywords"),
        ("url", "URL"),
        ("social", "Social"),
    ]
    for json_key, label in field_order:
        raw = record.get(json_key, None)
        text = _stringify(raw).strip()
        if text:
            parts.append(f"{label}: {text}")
    return "\n".join(parts)


@dataclass
class OrganisationPrepared:
    data: Dict[str, Any]
    text: str


def load_orgs() -> List[Dict[str, Any]]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Organisation data file not found: {DATA_PATH}")
    with DATA_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def generate_all_embeddings(texts: List[str]) -> List[List[float]]:
    embeddings: List[List[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        resp = client.embeddings.create(model=EMBED_MODEL, input=batch)
        batch_embeddings = [item.embedding for item in resp.data]
        embeddings.extend(batch_embeddings)
        print(f"Embedded {i + len(batch)}/{len(texts)}")
    if len(embeddings) != len(texts):
        raise RuntimeError(
            f"Embedding count mismatch. Expected {len(texts)}, got {len(embeddings)}"
        )
    return embeddings


def upsert_org_with_embedding(record: Dict[str, Any], embedding: List[float]) -> Tuple[Organisation, bool]:
    # Extract fields with defaults
    name = _stringify(record.get("name")).strip()
    abbreviation = _stringify(record.get("abbreviation")).strip()
    scope = _stringify(record.get("scope")).strip()
    mission = _stringify(record.get("mission")).strip()
    domains = record.get("domains") or []
    core_activities = record.get("core_activities") or []
    flagship_projects = record.get("flagship_projects") or []
    target_members = _stringify(record.get("target_members")).strip()
    affiliations = record.get("affiliations") or []
    partnerships = record.get("partnerships", None)
    skills_outcomes = record.get("skills_outcomes") or []
    keywords = record.get("keywords") or []
    url = _stringify(record.get("url")).strip()
    social = record.get("social", None)

    # Upsert policy: prefer abbreviation when present; else fallback to unique name
    unique_lookup: Dict[str, Any]
    if abbreviation:
        unique_lookup = {"abbreviation": abbreviation}
    else:
        unique_lookup = {"name": name}

    obj, created = Organisation.objects.get_or_create(
        **unique_lookup,
        defaults={
            "name": name,
            "abbreviation": abbreviation,
            "scope": scope,
            "mission": mission,
            "domains": domains,
            "core_activities": core_activities,
            "flagship_projects": flagship_projects,
            "target_members": target_members,
            "affiliations": affiliations,
            "partnerships": partnerships,
            "skills_outcomes": skills_outcomes,
            "keywords": keywords,
            "url": url,
            "social": social,
            "embedding": embedding,
        },
    )

    if not created:
        changed = False
        # Update scalar and JSON fields
        updates: Dict[str, Any] = {
            "name": name,
            "abbreviation": abbreviation,
            "scope": scope,
            "mission": mission,
            "domains": domains,
            "core_activities": core_activities,
            "flagship_projects": flagship_projects,
            "target_members": target_members,
            "affiliations": affiliations,
            "partnerships": partnerships,
            "skills_outcomes": skills_outcomes,
            "keywords": keywords,
            "url": url,
            "social": social,
        }
        for field, value in updates.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True
        # Always refresh embedding
        if obj.embedding != embedding:
            obj.embedding = embedding
            changed = True
        if changed:
            obj.save()

    return obj, created


def main() -> None:
    records = load_orgs()
    prepared: List[OrganisationPrepared] = [
        OrganisationPrepared(data=rec, text=build_org_text(rec)) for rec in records
    ]
    texts: List[str] = [item.text for item in prepared]
    print(f"Generating embeddings for {len(texts)} organisations using {EMBED_MODEL} ...")
    embeddings: List[List[float]] = generate_all_embeddings(texts)

    print("Upserting organisations with embeddings ...")
    created_count = 0
    updated_count = 0
    for item, emb in zip(prepared, embeddings):
        _, created = upsert_org_with_embedding(item.data, emb)
        if created:
            created_count += 1
        else:
            updated_count += 1
    print(f"Done. Created: {created_count}, Updated: {updated_count}")


if __name__ == "__main__":
    main()


