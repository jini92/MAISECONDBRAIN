"""벡터 검색 엔진 — 코사인 유사도 기반 Top-K"""

from __future__ import annotations

import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """두 벡터의 코사인 유사도"""
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def search(
    query_embedding: np.ndarray,
    embeddings: dict[str, np.ndarray],
    top_k: int = 10,
    min_score: float = 0.0,
) -> list[tuple[str, float]]:
    """코사인 유사도 기반 Top-K 검색.

    Args:
        query_embedding: 질문 벡터
        embeddings: {노트명: 벡터} 딕셔너리
        top_k: 상위 K개
        min_score: 최소 유사도 컷오프

    Returns:
        [(노트명, 유사도)] 내림차순
    """
    if not embeddings:
        return []

    # 매트릭스 연산으로 일괄 계산
    names = list(embeddings.keys())
    matrix = np.stack([embeddings[n] for n in names])

    # 정규화
    query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)
    matrix_norm = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10)

    # 코사인 유사도
    scores = matrix_norm @ query_norm

    # Top-K
    top_indices = np.argsort(scores)[::-1][:top_k]
    results = []
    for idx in top_indices:
        score = float(scores[idx])
        if score >= min_score:
            results.append((names[idx], score))

    return results
