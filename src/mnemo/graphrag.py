"""GraphRAG 쿼리 엔진 — 벡터 + 그래프 하이브리드 검색 + LLM 답변

Phase 4 (2026-02-24): Ollama LLM 통합으로 자연어 답변 생성 지원.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import networkx as nx
import numpy as np

from .graph_search import expand_from_nodes, get_subgraph_context
from .hybrid_search import hybrid_search
from .vector_search import search as vector_search

if TYPE_CHECKING:
    from .parser import NoteDocument


def ollama_llm_fn(prompt: str, model: str | None = None) -> str:
    """Ollama 로컬 LLM으로 답변 생성."""
    import ollama

    if model is None:
        model = os.environ.get("MNEMO_LLM_MODEL", "llama3.1:8b")

    try:
        resp = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.3, "num_predict": 1000},
        )
        answer = resp["message"]["content"].strip()
        # qwen3 thinking 태그 제거
        import re
        answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL).strip()
        return answer
    except Exception as e:
        return f"[LLM Error: {e}]"


def get_default_llm_fn():
    """환경변수 기반으로 기본 LLM 함수 반환. 비활성이면 None."""
    if os.environ.get("MNEMO_USE_LLM", "").lower() in ("true", "1", "yes"):
        return ollama_llm_fn
    return None


@dataclass
class QueryResult:
    """GraphRAG 쿼리 결과"""
    answer: str
    sources: list[dict] = field(default_factory=list)
    graph_context: list[dict] = field(default_factory=list)
    vector_scores: list[tuple[str, float]] = field(default_factory=list)
    expanded_nodes: int = 0


def _build_context_prompt(
    question: str,
    sources: list[dict],
    graph_context: list[dict],
    notes_content: dict[str, str],
    max_context_chars: int = 12000,
    query_type: str = "factual",
) -> str:
    """LLM에 전달할 컨텍스트 프롬프트 구성.

    Args:
        query_type: factual/relational/exploratory — 답변 스타일 조절
    """
    parts = []

    # 시스템 지시 (쿼리 타입별)
    if query_type == "relational":
        parts.append("당신은 지식 그래프 분석 전문가입니다. 노트 간 관계, 인물 연결, 프로젝트 시너지를 중심으로 답변하세요.\n")
    elif query_type == "exploratory":
        parts.append("당신은 지식 통합 분석가입니다. 여러 노트의 내용을 종합하여 트렌드, 비교, 전략적 인사이트를 도출하세요.\n")
    else:
        parts.append("당신은 개인 지식 베이스 검색 전문가입니다. 검색된 노트에서 정확한 사실을 추출하여 답변하세요.\n")

    parts.append("## 검색된 관련 노트\n")

    # 관련 노트 내용 (frontmatter 제거 후 핵심 부분)
    char_count = 0
    for src in sources:
        name = src["name"]
        key = src.get("key", name)
        content = notes_content.get(key, notes_content.get(name, ""))
        if not content:
            continue

        # frontmatter 제거
        if content.startswith("---"):
            end = content.find("---", 3)
            if end != -1:
                content = content[end + 3:].lstrip("\n")

        # 길이 제한
        remaining = max_context_chars - char_count
        if remaining <= 200:
            break

        truncated = content[:remaining]
        etype = src.get('entity_type', '?')
        score = src.get('combined_score', 0)
        parts.append(f"### [{name}] (type: {etype}, relevance: {score:.3f})")
        parts.append(truncated)
        parts.append("")
        char_count += len(truncated)

    # 그래프 관계 정보 (의미적 엣지 우선)
    if graph_context:
        parts.append("## 그래프 관계 (노트 간 연결)")
        semantic_types = {"uses", "derived_from", "alternatives", "supports", "contradicts", "participants"}
        for ctx in graph_context[:15]:
            conns = ctx.get("connections", [])
            # 의미적 관계 우선, wiki_link/related 후순위
            semantic = [c for c in conns if c.get("type") in semantic_types]
            other = [c for c in conns if c.get("type") not in semantic_types]
            display = semantic[:5] + other[:3]
            if display:
                conn_str = ", ".join(f"{c['target']}({c['type']})" for c in display)
                parts.append(f"- {ctx['name']} → {conn_str}")

    # 질문 + 답변 가이드
    parts.append(f"\n## 질문\n{question}")
    parts.append("""
## 답변 규칙
1. 위 노트들의 내용과 관계를 바탕으로 답변하세요
2. 참고한 노트를 [노트명]으로 인용하세요
3. 노트에 없는 정보를 추측하지 마세요
4. 핵심을 먼저, 세부사항은 후순위로""")

    return "\n".join(parts)


def query(
    question: str,
    G: nx.DiGraph,
    embeddings: dict[str, np.ndarray],
    notes_content: dict[str, str],
    query_embedding: np.ndarray | None = None,
    embed_fn=None,
    llm_fn=None,
    top_k: int = 5,
    hops: int = 2,
    alpha: float = 0.6,
    beta: float = 0.4,
) -> QueryResult:
    """GraphRAG 하이브리드 쿼리.

    Args:
        question: 자연어 질문
        G: NetworkX 지식그래프
        embeddings: {노트명: 벡터}
        notes_content: {노트명: 본문텍스트}
        query_embedding: 질문 벡터 (None이면 embed_fn 사용)
        embed_fn: 텍스트 → 벡터 함수
        llm_fn: 프롬프트 → 답변 함수
        top_k: 벡터 검색 상위 K
        hops: 그래프 확장 깊이
        alpha: 벡터 가중치
        beta: 그래프 가중치

    Returns:
        QueryResult
    """
    # 1. 질문 임베딩
    if query_embedding is None and embed_fn is not None:
        query_embedding = embed_fn(question)

    # 2. 하이브리드 검색 (키워드 + 벡터 + 그래프)
    hybrid_results = hybrid_search(
        question, G, embeddings, notes_content,
        query_embedding=query_embedding, top_k=top_k,
    )

    # 3. 시드 노드에서 그래프 확장
    seed_nodes = [r.key for r in hybrid_results]
    expanded = expand_from_nodes(G, seed_nodes, hops=hops)

    # 4. 컨텍스트 구성
    top_node_names = set(seed_nodes)
    graph_context = get_subgraph_context(G, top_node_names | expanded, max_nodes=top_k * 2)

    sources = []
    for r in hybrid_results:
        sources.append({
            "key": r.key,
            "name": r.name,
            "entity_type": r.entity_type,
            "combined_score": r.score,
            "vector_score": r.vector_score,
            "graph_score": r.graph_score,
        })

    # 6. LLM 답변 생성
    answer = ""
    if llm_fn is not None:
        # 쿼리 타입 분류 (동적 프롬프트)
        try:
            from .query_classifier import classify_query
            q_type = classify_query(question)
        except ImportError:
            q_type = "factual"
        prompt = _build_context_prompt(question, sources, graph_context, notes_content,
                                       query_type=q_type)
        answer = llm_fn(prompt)
    else:
        # LLM 없으면 소스 목록만 반환
        answer = f"관련 노트 {len(sources)}개 발견:\n"
        for src in sources:
            answer += f"  - [{src['name']}] (type: {src['entity_type']}, score: {src['combined_score']})\n"

    return QueryResult(
        answer=answer,
        sources=sources,
        graph_context=graph_context,
        vector_scores=[(r.key, r.vector_score) for r in hybrid_results],
        expanded_nodes=len(expanded),
    )
