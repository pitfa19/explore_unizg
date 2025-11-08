#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path
from typing import List, Tuple

import numpy as np


def setup_django():
    script_path = Path(__file__).resolve()
    project_root = script_path.parents[2]  # .../explore_unizg
    backend_dir = project_root / "backend"
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
    import django  # noqa: WPS433
    django.setup()


def fetch_embeddings() -> Tuple[List[int], np.ndarray]:
    from graph_integration.models import Faculty  # noqa: WPS433

    faculties = list(Faculty.objects.exclude(embedding=None))
    ids: List[int] = []
    vectors: List[np.ndarray] = []
    for f in faculties:
        try:
            vec = np.asarray(f.embedding, dtype=np.float32)
            if vec.ndim != 1:
                continue
            ids.append(f.id)
            vectors.append(vec)
        except Exception:
            continue
    if not vectors:
        return [], np.zeros((0, 0), dtype=np.float32)
    # Ensure consistent dimensionality
    dim = min(v.shape[0] for v in vectors)
    X = np.stack([v[:dim] for v in vectors], axis=0)
    return ids, X


def l2_normalize(X: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return X / norms


def run_pca(X: np.ndarray, n_components: int) -> np.ndarray:
    if X.shape[0] == 0:
        return X
    n_components = max(1, min(n_components, X.shape[0] - 1, X.shape[1]))
    if n_components <= 0:
        return X
    try:
        from sklearn.decomposition import PCA  # noqa: WPS433
    except Exception as e:
        raise RuntimeError("scikit-learn is required. Install with `pip install scikit-learn`.") from e
    pca = PCA(n_components=n_components, svd_solver="auto", random_state=42)
    return pca.fit_transform(X)


def run_kmeans(X: np.ndarray, k: int) -> np.ndarray:
    if X.shape[0] == 0:
        return np.zeros((0,), dtype=np.int32)
    try:
        from sklearn.cluster import KMeans  # noqa: WPS433
    except Exception as e:
        raise RuntimeError("scikit-learn is required. Install with `pip install scikit-learn`.") from e
    k = max(1, min(k, X.shape[0]))
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(X)
    return labels.astype(np.int32)


def save_clusters(ids: List[int], labels: np.ndarray, dry_run: bool = False) -> int:
    from graph_integration.models import Faculty  # noqa: WPS433

    if not ids:
        return 0
    by_id = {fid: label for fid, label in zip(ids, labels.tolist())}
    objs = list(Faculty.objects.filter(id__in=ids))
    for obj in objs:
        obj.cluster = by_id.get(obj.id)
    if dry_run:
        return len(objs)
    Faculty.objects.bulk_update(objs, ["cluster"])
    return len(objs)


def main():
    parser = argparse.ArgumentParser(description="Compute clusters for Faculty embeddings and upload to DB.")
    parser.add_argument("--k", type=int, default=5, help="Number of KMeans clusters (default: 5)")
    parser.add_argument("--pca-components", type=int, default=10, help="Number of PCA components before clustering (default: 10)")
    parser.add_argument("--no-pca", action="store_true", help="Disable PCA step and cluster on normalized embeddings directly")
    parser.add_argument("--dry-run", action="store_true", help="Compute but do not write changes to DB")
    args = parser.parse_args()

    setup_django()
    ids, X = fetch_embeddings()
    if X.shape[0] == 0:
        print("No embeddings found. Exiting.")
        return

    Xn = l2_normalize(X)
    if args.no_pca:
        Z = Xn
    else:
        Z = run_pca(Xn, n_components=args.pca_components)

    labels = run_kmeans(Z, k=args.k)
    updated = save_clusters(ids, labels, dry_run=args.dry_run)
    print(f"Processed {X.shape[0]} faculties, updated cluster labels for {updated} rows (k={args.k}).")


if __name__ == "__main__":
    main()


