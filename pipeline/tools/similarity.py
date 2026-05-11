"""
tools/similarity.py — Embedding-based plagiarism detection.

Computes cosine similarity across all student answer transcripts.
Pairs above the configured threshold are flagged.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass


@dataclass
class SimilarityFlag:
    student_a: str
    student_b: str
    score: float   # cosine similarity 0–1


def cosine_similarity_matrix(embeddings: list[list[float]]) -> np.ndarray:
    """
    Compute the N×N cosine similarity matrix for a list of embedding vectors.

    Numerically stable: normalises each vector before computing the dot product.
    """
    arr = np.array(embeddings, dtype=np.float32)
    # Normalise rows to unit length
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1e-9, norms)  # avoid div-by-zero
    normed = arr / norms
    return normed @ normed.T  # N×N similarity matrix


def find_suspicious_pairs(
    student_ids: list[str],
    embeddings: list[list[float]],
    threshold: float,
) -> list[SimilarityFlag]:
    """
    Return all student pairs whose combined transcript similarity
    exceeds `threshold`.

    Args:
        student_ids:  Parallel list of student identifiers.
        embeddings:   Parallel list of embedding vectors (one per student).
        threshold:    Cosine similarity cutoff (e.g. 0.92).

    Returns:
        List of SimilarityFlag objects, sorted by score descending.
    """
    if len(student_ids) < 2:
        return []

    matrix = cosine_similarity_matrix(embeddings)
    flags: list[SimilarityFlag] = []

    n = len(student_ids)
    for i in range(n):
        for j in range(i + 1, n):
            score = float(matrix[i, j])
            if score >= threshold:
                flags.append(SimilarityFlag(
                    student_a=student_ids[i],
                    student_b=student_ids[j],
                    score=round(score, 4),
                ))

    flags.sort(key=lambda f: f.score, reverse=True)
    return flags


def build_student_flag_map(
    flags: list[SimilarityFlag],
) -> dict[str, tuple[float, str]]:
    """
    Convert a list of SimilarityFlags into a per-student lookup:
        { student_id: (highest_score, matching_student_id) }

    Each student only gets flagged against their highest-scoring match.
    """
    result: dict[str, tuple[float, str]] = {}
    for flag in flags:
        # flags are sorted desc — first occurrence is the highest score
        if flag.student_a not in result:
            result[flag.student_a] = (flag.score, flag.student_b)
        if flag.student_b not in result:
            result[flag.student_b] = (flag.score, flag.student_a)
    return result
