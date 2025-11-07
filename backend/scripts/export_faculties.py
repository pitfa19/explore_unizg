import os
import sys
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

# Make project importable
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


def faculty_to_dict(f: Faculty) -> Dict[str, Any]:
    return {
        "id": f.id,
        "name": f.name,
        "abbreviation": f.abbreviation,
        "domain_areas": f.domain_areas,
        "programs": f.programs,
        "research_topics": f.research_topics,
        "methods_and_tech": f.methods_and_tech,
        "affiliations_and_labs": f.affiliations_and_labs,
        "typical_outputs": f.typical_outputs,
        "keywords": f.keywords,
        "url": f.url,
        "embedding": f.embedding,
    }


def export_faculties() -> List[Dict[str, Any]]:
    faculties = Faculty.objects.all().order_by("abbreviation", "name")
    return [faculty_to_dict(f) for f in faculties]


def main(argv: Optional[List[str]] = None) -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Export all faculties (including embeddings) to JSON."
    )
    parser.add_argument(
        "--out",
        type=str,
        default="",
        help="Output file path. If omitted, prints to stdout.",
    )
    args = parser.parse_args(argv)

    data = export_faculties()
    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        print(f"Wrote {len(data)} faculties to {out_path}")
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

