"""Reranker — Cross-Encoder 기반 검색 결과 재정렬"""

from __future__ import annotations

import os
from typing import Any

import numpy as np

# lazy-loaded singleton
_reranker_model = None
_reranker_model_name = None

DEFAULT_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def is_reranker_enabled() -> bool:
    """환경변수로 reranker 활성화 여부 확인"""
    return os.environ.get("MNEMO_USE_RERANKER", "").lower() in ("true", "1", "yes")


def _get_reranker(model_name: str | None = None):
    """CrossEncoder 모델 lazy loading"""
    global _reranker_model, _reranker_model_name
    if model_name is None:
        model_name = os.environ.get("MNEMO_RERANKER_MODEL", DEFAULT_RERANKER_MODEL)
    if _reranker_model is None or _reranker_model_name != model_name:
        from sentence_transformers import CrossEncoder
        _reranker_model = CrossEncoder(model_name)
        _reranker_model_name = model_name
    return _reranker_model


class Reranker:
    """Cross-Encoder 기반 reranker"""

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name

    def rerank(
        self,
        query: str,
        results: list[dict[str, Any]],
        top_k: int = 10,
        snippet_key: str = "snippet",
    ) -> list[dict[str, Any]]:
        """검색 결과를 cross-encoder로 재정렬.

        Args:
            query: 검색 쿼리
            results: [{"name": ..., "snippet": ..., "score": ..., ...}]
            top_k: 상위 K개 반환
            snippet_key: 텍스트 필드 키

        Returns:
            rerank_score가 추가된 재정렬 결과
        """
        if not results:
            return []

        model = _get_reranker(self.model_name)
        pairs = [(query, r.get(snippet_key, r.get("name", ""))) for r in results]
        scores = model.predict(pairs)

        for r, s in zip(results, scores):
            r["rerank_score"] = float(s)

        reranked = sorted(results, key=lambda x: x["rerank_score"], reverse=True)
        return reranked[:top_k]


def rerank_search_results(
    query: str,
    results: list[dict[str, Any]],
    top_k: int = 10,
    snippet_key: str = "snippet",
    model_name: str | None = None,
) -> list[dict[str, Any]]:
    """편의 함수: 검색 결과 재정렬"""
    reranker = Reranker(model_name=model_name)
    return reranker.rerank(query, results, top_k=top_k, snippet_key=snippet_key)
