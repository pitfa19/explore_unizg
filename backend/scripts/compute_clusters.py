import os
import sys
from typing import Any, Dict, List
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

from sklearn.decomposition import PCA  # noqa: E402
from sklearn.cluster import KMeans  # noqa: E402


def l2_normalize_rows(X: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0.0, 1.0, norms)
    return X / norms


def compute_features(embeddings: List[List[float]], use_pca2d: bool) -> np.ndarray:
    if not embeddings:
        return np.zeros((0, 2 if use_pca2d else 0))
    X = np.array(embeddings, dtype=float)
    X_norm = l2_normalize_rows(X)
    if use_pca2d:
        # If fewer than 2 samples, PCA(2) is unstable; fall back to zeros
        if X_norm.shape[0] < 2:
            return np.zeros((X_norm.shape[0], 2))
        pca = PCA(n_components=2, random_state=42)
        return pca.fit_transform(X_norm)
    return X_norm


def update_faculty_clusters(k: int, use_pca2d: bool, out_path: str = "") -> None:
    faculties_all = list(Faculty.objects.exclude(embedding__isnull=True))
    embeds: List[List[float]] = []
    valid_indices: List[int] = []
    for i, f in enumerate(faculties_all):
        if isinstance(f.embedding, list) and len(f.embedding) > 0:
            embeds.append(f.embedding)
            valid_indices.append(i)
    if not embeds:
        print("[faculties] No embeddings found.")
        return
    faculties = [faculties_all[i] for i in valid_indices]
    F = compute_features(embeds, use_pca2d)
    eff_k = int(min(k, max(1, F.shape[0])))
    km = KMeans(n_clusters=eff_k, random_state=42, n_init="auto")
    labels = km.fit_predict(F)
    for i, f in enumerate(faculties):
        f.cluster = int(labels[i])
    Faculty.objects.bulk_update(faculties, ["cluster"])
    print(f"[faculties] Updated cluster (k={eff_k}, mode={'pca2d' if use_pca2d else 'embeddings'}) for {len(faculties)} rows")
    if out_path:
        export = [
            {"abbreviation": (f.abbreviation or "").strip(), "cluster": int(labels[i])}
            for i, f in enumerate(faculties)
        ]
        path = Path(out_path).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(export, fh, ensure_ascii=False, indent=2)
        print(f"[faculties] Wrote clusters to {path}")


def update_org_clusters(k: int, use_pca2d: bool, out_path: str = "") -> None:
    orgs_all = list(Organisation.objects.exclude(embedding__isnull=True))
    embeds: List[List[float]] = []
    valid_indices: List[int] = []
    for i, o in enumerate(orgs_all):
        if isinstance(o.embedding, list) and len(o.embedding) > 0:
            embeds.append(o.embedding)
            valid_indices.append(i)
    if not embeds:
        print("[organisations] No embeddings found.")
        return
    orgs = [orgs_all[i] for i in valid_indices]
    F = compute_features(embeds, use_pca2d)
    eff_k = int(min(k, max(1, F.shape[0])))
    km = KMeans(n_clusters=eff_k, random_state=42, n_init="auto")
    labels = km.fit_predict(F)
    for i, o in enumerate(orgs):
        o.cluster = int(labels[i])
    Organisation.objects.bulk_update(orgs, ["cluster"])
    print(f"[organisations] Updated cluster (k={eff_k}, mode={'pca2d' if use_pca2d else 'embeddings'}) for {len(orgs)} rows")
    if out_path:
        export = []
        for i, o in enumerate(orgs):
            abbr = (o.abbreviation or "").strip()
            name = (o.name or "").strip()
            ident = abbr if abbr else name
            export.append({"identifier": ident, "cluster": int(labels[i])})
        path = Path(out_path).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(export, fh, ensure_ascii=False, indent=2)
        print(f"[organisations] Wrote clusters to {path}")


def main(argv: List[str] | None = None) -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Compute KMeans clusters for Faculty and Organisation (default k=7)."
    )
    parser.add_argument("--k", type=int, default=7, help="K for KMeans (default: 7)")
    parser.add_argument(
        "--mode",
        type=str,
        choices=["pca2d", "embeddings"],
        default="pca2d",
        help="Feature space to run KMeans in (default: pca2d)",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default="",
        help="Optional directory to export JSON summaries.",
    )
    args = parser.parse_args(argv)

    use_pca2d = args.mode == "pca2d"
    if args.out_dir:
        out_dir = Path(args.out_dir).expanduser().resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        fac_out = str(out_dir / "faculties_clusters.json")
        org_out = str(out_dir / "organisations_clusters.json")
    else:
        fac_out = ""
        org_out = ""

    update_faculty_clusters(args.k, use_pca2d, out_path=fac_out)
    update_org_clusters(args.k, use_pca2d, out_path=org_out)


if __name__ == "__main__":
    main()


