import os
import sys
from typing import Any, Dict, List, Tuple
import numpy as np
import json
from pathlib import Path

# Project paths
PROJECT_ROOT = "/home/pitfa/Documents/explore_unizg"
BACKEND_DIR = f"{PROJECT_ROOT}/backend"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Django setup
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
import django  # noqa: E402
from django.apps import apps as django_apps  # noqa: E402

if not django_apps.ready:
    django.setup()

from graph_integration.models import Faculty  # noqa: E402

# ML utils
from sklearn.decomposition import PCA  # noqa: E402
from sklearn.neighbors import NearestNeighbors  # noqa: E402


def fetch_faculty_embeddings() -> Tuple[List[str], np.ndarray, List[Faculty]]:
    faculties_qs = Faculty.objects.exclude(embedding__isnull=True)
    faculties: List[Faculty] = list(faculties_qs)
    abbreviations: List[str] = [(f.abbreviation or "").strip() for f in faculties]
    embeddings: List[List[float]] = []
    valid_indices: List[int] = []
    for i, f in enumerate(faculties):
        if isinstance(f.embedding, list) and len(f.embedding) > 0:
            embeddings.append(f.embedding)
            valid_indices.append(i)
    if not embeddings:
        raise RuntimeError("No faculties with embeddings found.")
    # Filter to valid faculties only
    faculties = [faculties[i] for i in valid_indices]
    abbreviations = [abbreviations[i] for i in valid_indices]
    X = np.array(embeddings, dtype=float)
    return abbreviations, X, faculties


def l2_normalize_rows(X: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return X / norms


def compute_knn_edges_pca2d(X: np.ndarray, k: int) -> Tuple[np.ndarray, List[List[Dict[str, Any]]]]:
    X_norm = l2_normalize_rows(X)
    pca = PCA(n_components=2, random_state=42)
    X_2d = pca.fit_transform(X_norm)
    # Adjust k to dataset size
    neighbors = int(min(k, X_2d.shape[0] - 1))
    if neighbors <= 0:
        return X_2d, [[] for _ in range(X_2d.shape[0])]
    nbrs = NearestNeighbors(n_neighbors=neighbors + 1)
    nbrs.fit(X_2d)
    distances, indices = nbrs.kneighbors(X_2d)
    edges_for_node: List[List[Dict[str, Any]]] = []
    for i in range(X_2d.shape[0]):
        node_edges: List[Dict[str, Any]] = []
        for j_idx, d in zip(indices[i][1:], distances[i][1:]):
            node_edges.append({"index": int(j_idx), "distance": float(d)})
        edges_for_node.append(node_edges)
    return X_2d, edges_for_node


def main(argv: List[str] | None = None) -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Compute L2→PCA(2D)→kNN edges and update Faculty.knn_edges")
    parser.add_argument("--k", type=int, default=4, help="Number of neighbors (default: 4)")
    parser.add_argument(
        "--out",
        type=str,
        default="",
        help="Optional output JSON file path. When set, edges are also written to this file.",
    )
    args = parser.parse_args(argv)

    k = args.k
    abbrs, X, faculties = fetch_faculty_embeddings()
    X_2d, edges_idx = compute_knn_edges_pca2d(X, k)
    # Build edge payloads referencing neighbor abbreviations
    exported: List[Dict[str, Any]] = []
    for i, faculty in enumerate(faculties):
        neighbor_entries = []
        for edge in edges_idx[i]:
            j = edge["index"]
            neighbor_entries.append(
                {
                    "neighbor_abbreviation": abbrs[j],
                    "distance": edge["distance"],
                }
            )
        faculty.knn_edges = neighbor_entries
        exported.append(
            {
                "abbreviation": abbrs[i],
                "knn_edges": neighbor_entries,
                "pca": {"x": float(X_2d[i, 0]), "y": float(X_2d[i, 1])},
            }
        )

    Faculty.objects.bulk_update(faculties, ["knn_edges"])
    print(f"Updated knn_edges for {len(faculties)} faculties (k={k})")

    if args.out:
        out_path = Path(args.out).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as fh:
            json.dump(exported, fh, ensure_ascii=False, indent=2)
        print(f"Wrote edges JSON for {len(exported)} faculties to {out_path}")


if __name__ == "__main__":
    main()


