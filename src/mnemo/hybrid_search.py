"""하이브리드 검색 — 키워드 매칭 + 벡터 유사도 + 그래프 구조 결합"""

from __future__ import annotations

import re
from dataclasses import dataclass

import networkx as nx
import numpy as np

from .vector_search import search as vector_search


@dataclass
class SearchResult:
    key: str  # 경로 기반 고유키
    name: str  # 표시용 파일명
    score: float
    keyword_score: float
    vector_score: float
    graph_score: float
    entity_type: str


def keyword_match(
    query: str,
    G: nx.DiGraph,
    notes_content: dict[str, str],
    top_k: int = 20,
) -> list[tuple[str, float]]:
    """키워드 매칭 검색 (노드명 + 본문)"""
    query_lower = query.lower()
    keywords = [w.strip() for w in re.split(r"[\s,]+", query_lower) if len(w.strip()) > 1]

    if not keywords:
        return []

    scored = []
    for node in G.nodes():
        score = 0.0
        data = G.nodes.get(node, {})
        # 표시용 이름 (name 속성) 또는 키의 마지막 부분
        display_name = data.get("name", node.rsplit("/", 1)[-1]).lower()
        node_lower = node.lower()

        # 노드명 매칭 (가중치 높음)
        for kw in keywords:
            if kw in display_name:
                score += 3.0
            if kw == display_name:
                score += 5.0
            # 경로에서도 매칭
            if kw in node_lower and kw not in display_name:
                score += 1.0

        # 본문 매칭
        content = notes_content.get(node, "").lower()
        for kw in keywords:
            count = content.count(kw)
            if count > 0:
                score += min(count * 0.5, 3.0)

        # 노드 속성 (tags, entity_type)
        tags = data.get("tags", [])
        for kw in keywords:
            for tag in tags:
                if kw in str(tag).lower():
                    score += 2.0

        if score > 0:
            scored.append((node, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def hybrid_search(
    query: str,
    G: nx.DiGraph,
    embeddings: dict[str, np.ndarray],
    notes_content: dict[str, str],
    query_embedding: np.ndarray | None = None,
    top_k: int = 10,
    keyword_weight: float = 0.5,
    vector_weight: float = 0.3,
    graph_weight: float = 0.2,
) -> list[SearchResult]:
    """키워드 + 벡터 + 그래프 하이브리드 검색"""

    # 1. 키워드 검색
    kw_results = keyword_match(query, G, notes_content, top_k=top_k * 3)
    kw_scores = {name: score for name, score in kw_results}
    kw_max = max(kw_scores.values()) if kw_scores else 1.0

    # 2. 벡터 검색
    vec_scores = {}
    if query_embedding is not None and embeddings:
        vec_results = vector_search(query_embedding, embeddings, top_k=top_k * 3)
        vec_scores = {name: score for name, score in vec_results}
    vec_max = max(vec_scores.values()) if vec_scores else 1.0

    # 3. 그래프 점수 (PageRank)
    try:
        pagerank = nx.pagerank(G, weight="weight")
    except Exception:
        pagerank = {}
    pr_max = max(pagerank.values()) if pagerank else 1.0

    # 4. 후보 노드 합치기
    candidates = set(kw_scores.keys()) | set(vec_scores.keys())

    # 5. 점수 결합
    results = []
    for node in candidates:
        data = G.nodes.get(node, {})
        display_name = data.get("name", node.rsplit("/", 1)[-1])
        if display_name.lower().startswith("untitled"):
            continue

        kw_norm = kw_scores.get(node, 0.0) / kw_max
        vec_norm = vec_scores.get(node, 0.0) / vec_max
        graph_norm = pagerank.get(node, 0.0) / pr_max

        combined = (
            keyword_weight * kw_norm
            + vector_weight * vec_norm
            + graph_weight * graph_norm
        )

        results.append(SearchResult(
            key=node,
            name=display_name,
            score=round(combined, 4),
            keyword_score=round(kw_norm, 4),
            vector_score=round(vec_norm, 4),
            graph_score=round(graph_norm, 4),
            entity_type=data.get("entity_type", "unknown"),
        ))

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:top_k]
