import os
import sys
from typing import Any, Dict, List, Tuple
from pathlib import Path
import json
import numpy as np

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

from graph_integration.models import Faculty, Organisation  # noqa: E402

# ML utils
from sklearn.decomposition import PCA  # noqa: E402
from sklearn.neighbors import NearestNeighbors  # noqa: E402
from sklearn.cluster import KMeans  # noqa: E402


def l2_normalize_rows(X: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return X / norms


def compute_pca2d_knn_kmeans(
    X: np.ndarray,
    k_neighbors: int,
    kmeans_k: int,
) -> Tuple[np.ndarray, List[List[Dict[str, Any]]], np.ndarray]:
    """
    Returns:
      - X_2d: PCA 2D projection
      - edges_for_node: list per row of [{'index': j, 'distance': d}, ...]
      - clusters: integer labels shape (n,)
    """
    if X.shape[0] == 0:
        return np.zeros((0, 2)), [], np.array([], dtype=int)
    X_norm = l2_normalize_rows(X)
    # If less than 2 samples, PCA(2) cannot be computed; fallback to zeros
    if X_norm.shape[0] < 2:
        X_2d = np.zeros((X_norm.shape[0], 2))
        return X_2d, [[] for _ in range(X_norm.shape[0])], np.zeros((X_norm.shape[0],), dtype=int)
    pca = PCA(n_components=2, random_state=42)
    X_2d = pca.fit_transform(X_norm)
    neighbors = int(min(k_neighbors, X_2d.shape[0] - 1))
    if neighbors <= 0:
        edges_for_node = [[] for _ in range(X_2d.shape[0])]
    else:
        nbrs = NearestNeighbors(n_neighbors=neighbors + 1)
        nbrs.fit(X_2d)
        distances, indices = nbrs.kneighbors(X_2d)
        edges_for_node = []
        for i in range(X_2d.shape[0]):
            node_edges: List[Dict[str, Any]] = []
            for j_idx, d in zip(indices[i][1:], distances[i][1:]):
                node_edges.append({"index": int(j_idx), "distance": float(d)})
            edges_for_node.append(node_edges)
    # KMeans on PCA 2D for stability
    # If fewer samples than clusters, scikit-learn will error; cap to n_samples
    effective_k = int(min(kmeans_k, max(1, X_2d.shape[0])))
    if X_2d.shape[0] == 0:
        clusters = np.array([], dtype=int)
    else:
        kmeans = KMeans(n_clusters=effective_k, random_state=42, n_init="auto")
        clusters = kmeans.fit_predict(X_2d)
    return X_2d, edges_for_node, clusters


def build_identifier_list_faculties(faculties: List[Faculty]) -> List[str]:
    return [((f.abbreviation or "").strip()) for f in faculties]

def build_label_list_faculties(faculties: List[Faculty]) -> List[str]:
    import re as _re
    def _clean_name(text: str) -> str:
        return _re.sub(r"\s*\(UNIZG\)\s*$", "", (text or "").strip())
    return [_clean_name(f.name) for f in faculties]

def build_identifier_list_orgs(orgs: List[Organisation]) -> List[str]:
    identifiers: List[str] = []
    for o in orgs:
        abbr = (o.abbreviation or "").strip()
        name = (o.name or "").strip()
        identifiers.append(abbr if abbr else name)
    return identifiers

def build_label_list_orgs(orgs: List[Organisation]) -> List[str]:
    return [((o.name or "").strip()) for o in orgs]


def update_faculties(k_neighbors: int, kmeans_k: int, out: str = "", save_top: int = 3) -> None:
    faculties_all = list(Faculty.objects.exclude(embedding__isnull=True))
    embeddings: List[List[float]] = []
    valid_indices: List[int] = []
    for i, f in enumerate(faculties_all):
        if isinstance(f.embedding, list) and len(f.embedding) > 0:
            embeddings.append(f.embedding)
            valid_indices.append(i)
    faculties = [faculties_all[i] for i in valid_indices]
    if not faculties:
        print("No faculties with embeddings found.")
        return
    X = np.array(embeddings, dtype=float)
    X_2d, edges_idx, clusters = compute_pca2d_knn_kmeans(X, k_neighbors, kmeans_k)
    abbrs = build_identifier_list_faculties(faculties)
    labels = build_label_list_faculties(faculties)
    exported: List[Dict[str, Any]] = []
    for i, faculty in enumerate(faculties):
        neighbor_entries = []
        # take only top-N neighbors
        for edge in edges_idx[i][: max(0, int(save_top))]:
            j = edge["index"]
            neighbor_entries.append(
                {"neighbor_label": labels[j], "distance": edge["distance"]}
            )
        faculty.knn_edges = neighbor_entries
        faculty.cluster = int(clusters[i])
        exported.append(
            {
                "abbreviation": abbrs[i],
                "knn_edges": neighbor_entries,
                "cluster": int(clusters[i]),
                "pca": {"x": float(X_2d[i, 0]), "y": float(X_2d[i, 1])},
            }
        )
    Faculty.objects.bulk_update(faculties, ["knn_edges", "cluster"])
    if out:
        path = Path(out).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(exported, fh, ensure_ascii=False, indent=2)
        print(f"[faculties] Wrote {len(exported)} entries to {path}")
    print(f"[faculties] Updated knn_edges (k={k_neighbors}, saved_top={save_top}) and cluster (k={kmeans_k}) for {len(faculties)} rows")


def update_organisations(k_neighbors: int, kmeans_k: int, out: str = "", save_top: int = 3) -> None:
    orgs_all = list(Organisation.objects.exclude(embedding__isnull=True))
    embeddings: List[List[float]] = []
    valid_indices: List[int] = []
    for i, o in enumerate(orgs_all):
        if isinstance(o.embedding, list) and len(o.embedding) > 0:
            embeddings.append(o.embedding)
            valid_indices.append(i)
    orgs = [orgs_all[i] for i in valid_indices]
    if not orgs:
        print("No organisations with embeddings found.")
        return
    X = np.array(embeddings, dtype=float)
    X_2d, edges_idx, clusters = compute_pca2d_knn_kmeans(X, k_neighbors, kmeans_k)
    ids = build_identifier_list_orgs(orgs)
    org_labels = build_label_list_orgs(orgs)
    # Prepare nearest faculty (ensure at least one faculty edge)
    facs_all = list(Faculty.objects.exclude(embedding__isnull=True))
    fac_abbrs = [((f.abbreviation or "").strip()) for f in facs_all]
    fac_labels = build_label_list_faculties(facs_all)
    fac_embeddings = [f.embedding for f in facs_all if isinstance(f.embedding, list) and len(f.embedding) > 0]
    # Filter abbrs to those with valid embeddings as well
    valid_fac_indices = [i for i, f in enumerate(facs_all) if isinstance(f.embedding, list) and len(f.embedding) > 0]
    fac_abbrs = [fac_abbrs[i] for i in valid_fac_indices]
    fac_labels = [fac_labels[i] for i in valid_fac_indices]
    X_fac = np.array(fac_embeddings, dtype=float)
    X_fac_norm = l2_normalize_rows(X_fac) if X_fac.shape[0] else np.zeros((0, X.shape[1] if X.ndim == 2 else 0))
    X_org_norm = l2_normalize_rows(np.array(embeddings, dtype=float))
    exported: List[Dict[str, Any]] = []
    for i, org in enumerate(orgs):
        # 1) Take top-N org-org neighbors from PCA2D distances
        neighbor_entries = []
        for edge in edges_idx[i][: max(0, int(save_top))]:
            j = edge["index"]
            neighbor_entries.append(
                {"neighbor_label": org_labels[j], "distance": edge["distance"]}
            )
        # 2) Ensure at least one faculty neighbor: pick nearest faculty in L2-normalized embedding space
        if X_fac_norm.shape[0] > 0:
            v = X_org_norm[i : i + 1, :]
            # cosine similarity (dot product on L2 normalized vectors)
            sims = (v @ X_fac_norm.T).ravel()  # higher is closer
            best_idx = int(np.argmax(sims))
            faculty_label = fac_labels[best_idx]
            # If not already included, add or replace the farthest neighbor to ensure presence
            already_has_faculty = any(
                (entry.get("neighbor_label") == faculty_label) for entry in neighbor_entries
            )
            if not already_has_faculty:
                # Compute a pseudo-distance from similarity for sorting; convert sim to distance-like
                # Using (1 - sim) so closer => smaller value, similar to distances
                faculty_dist = float(1.0 - float(sims[best_idx]))
                new_entry = {"neighbor_label": faculty_label, "distance": faculty_dist}
                if len(neighbor_entries) < max(0, int(save_top)):
                    neighbor_entries.append(new_entry)
                else:
                    # Replace the farthest by distance
                    worst_idx = max(range(len(neighbor_entries)), key=lambda t: neighbor_entries[t]["distance"])
                    neighbor_entries[worst_idx] = new_entry
        # 3) Trim to save_top just in case
        neighbor_entries = sorted(neighbor_entries, key=lambda e: e["distance"])[: max(0, int(save_top))]
        org.knn_edges = neighbor_entries
        org.cluster = int(clusters[i])
        exported.append(
            {
                "identifier": ids[i],
                "knn_edges": neighbor_entries,
                "cluster": int(clusters[i]),
                "pca": {"x": float(X_2d[i, 0]), "y": float(X_2d[i, 1])},
            }
        )
    Organisation.objects.bulk_update(orgs, ["knn_edges", "cluster"])
    if out:
        path = Path(out).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(exported, fh, ensure_ascii=False, indent=2)
        print(f"[organisations] Wrote {len(exported)} entries to {path}")
    print(f"[organisations] Updated knn_edges (k={k_neighbors}, saved_top={save_top}, ensured 1 faculty link) and cluster (k={kmeans_k}) for {len(orgs)} rows")


def main(argv: List[str] | None = None) -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Compute L2→PCA(2D)→kNN edges (compute k, save top-N) and KMeans clusters for Faculty and Organisation. Ensures each Organisation links to at least one Faculty."
    )
    parser.add_argument("--k", type=int, default=5, help="Neighbors for kNN to compute (default: 5)")
    parser.add_argument("--save-top", type=int, default=3, help="Save only the top-N nearest neighbors per node (default: 3)")
    parser.add_argument("--kmeans", type=int, default=5, help="K for KMeans (default: 5)")
    parser.add_argument(
        "--out-dir",
        type=str,
        default="",
        help="Optional output directory to write exported JSON files.",
    )
    args = parser.parse_args(argv)

    out_dir = args.out_dir.strip()
    if out_dir:
        Path(out_dir).expanduser().resolve().mkdir(parents=True, exist_ok=True)
        out_fac = str(Path(out_dir) / "faculties_graph.json")
        out_org = str(Path(out_dir) / "organisations_graph.json")
    else:
        out_fac = ""
        out_org = ""

    update_faculties(args.k, args.kmeans, out=out_fac, save_top=args.save_top)
    update_organisations(args.k, args.kmeans, out=out_org, save_top=args.save_top)


if __name__ == "__main__":
    main()


