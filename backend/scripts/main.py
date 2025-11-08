import os
import sys
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple
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

from graph_integration.models import Faculty  # noqa: E402


try:
    from openai import OpenAI  # noqa: E402
except Exception as e:  # pragma: no cover
    raise RuntimeError("OpenAI SDK not installed. Please install with `pip install openai`.") from e


# Load environment from backend/.env if present
load_dotenv(str(Path(__file__).resolve().parents[1] / ".env"))

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY environment variable is not set. Export it before running this script."
    )


DATA_PATH = Path("/home/pitfa/Documents/explore_unizg/unizg_faculties.json")
EMBED_MODEL = "text-embedding-3-small"
BATCH_SIZE = 64


client = OpenAI(api_key=OPENAI_API_KEY)


def build_faculty_text(record: Dict[str, str]) -> str:
    parts: List[str] = []
    for key in [
        "Name",
        "Abbreviation",
        "Domain areas",
        "Programs",
        "Research topics",
        "Methods & tech",
        "Affiliations & labs",
        "Typical outputs",
        "Keywords",
        "URL",
    ]:
        value = (record.get(key) or "").strip()
        if value:
            parts.append(f"{key}: {value}")
    return "\n".join(parts)


@dataclass
class FacultyPrepared:
    data: Dict[str, str]
    text: str


def load_faculties() -> List[Dict[str, str]]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Faculty data file not found: {DATA_PATH}")
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


def upsert_faculty_with_embedding(record: Dict[str, str], embedding: List[float]) -> Tuple[Faculty, bool]:
    name = (record.get("Name") or "").strip()
    abbr = (record.get("Abbreviation") or "").strip()
    domain_areas = (record.get("Domain areas") or "").strip()
    programs = (record.get("Programs") or "").strip()
    research_topics = (record.get("Research topics") or "").strip()
    methods_and_tech = (record.get("Methods & tech") or "").strip()
    affiliations_and_labs = (record.get("Affiliations & labs") or "").strip()
    typical_outputs = (record.get("Typical outputs") or "").strip()
    keywords = (record.get("Keywords") or "").strip()
    url = (record.get("URL") or "").strip()

    obj, created = Faculty.objects.get_or_create(
        abbreviation=abbr,
        defaults={
            "name": name,
            "domain_areas": domain_areas,
            "programs": programs,
            "research_topics": research_topics,
            "methods_and_tech": methods_and_tech,
            "affiliations_and_labs": affiliations_and_labs,
            "typical_outputs": typical_outputs,
            "keywords": keywords,
            "url": url,
            "embedding": embedding,
        },
    )

    if not created:
        changed = False
        for field, value in {
            "name": name,
            "domain_areas": domain_areas,
            "programs": programs,
            "research_topics": research_topics,
            "methods_and_tech": methods_and_tech,
            "affiliations_and_labs": affiliations_and_labs,
            "typical_outputs": typical_outputs,
            "keywords": keywords,
            "url": url,
        }.items():
            if getattr(obj, field) != value:
                setattr(obj, field, value)
                changed = True
        # Always update embedding to freshly generated one
        if obj.embedding != embedding:
            obj.embedding = embedding
            changed = True
        if changed:
            obj.save()

    return obj, created


def main() -> None:
    records = load_faculties()
    prepared: List[FacultyPrepared] = [
        FacultyPrepared(data=rec, text=build_faculty_text(rec)) for rec in records
    ]

    texts: List[str] = [item.text for item in prepared]
    print(f"Generating embeddings for {len(texts)} faculties using {EMBED_MODEL} ...")
    embeddings: List[List[float]] = generate_all_embeddings(texts)

    print("Upserting faculties with embeddings ...")
    created_count = 0
    updated_count = 0
    for item, emb in zip(prepared, embeddings):
        _, created = upsert_faculty_with_embedding(item.data, emb)
        if created:
            created_count += 1
        else:
            updated_count += 1

    print(f"Done. Created: {created_count}, Updated: {updated_count}")


if __name__ == "__main__":
    main()
