#!/usr/bin/env python3
"""Phase 4.1 — Reranker A/B 테스트 + 검색 가중치 튜닝 벤치마크.

테스트 쿼리 셋으로 reranker ON/OFF + 동적 가중치 ON/OFF 비교.

Usage:
    python scripts/search_ab_test.py
    python scripts/search_ab_test.py --reranker-only
    python scripts/search_ab_test.py --weights-only
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

# --- Test queries with expected top results ---
TEST_QUERIES = [
    {
        "query": "베트남 화장품 Zalo 마케팅 전략",
        "type": "factual",
        "expected_top": ["vietnam-beauty", "베트남 화장품 사업 전략", "Zalo"],
        "description": "사실 기반 - 특정 프로젝트+기술 조합",
    },
    {
        "query": "MAIOSS 보안 스캐너 아키텍처",
        "type": "factual",
        "expected_top": ["maioss", "MAIOSS"],
        "description": "사실 기반 - 특정 프로젝트",
    },
    {
        "query": "AI 수익화 모델 비교",
        "type": "exploratory",
        "expected_top": ["AI 수익화", "수익화", "monetization"],
        "description": "탐색 - 넓은 주제",
    },
    {
        "query": "삼성 엔지니어링 미팅에서 논의된 기술 과제",
        "type": "relational",
        "expected_top": ["삼성 엔지니어링", "미팅", "POC"],
        "description": "관계 기반 - 이벤트+조직",
    },
    {
        "query": "Obsidian 플러그인 개발 계획",
        "type": "factual",
        "expected_top": ["maisecondbrain", "Obsidian", "플러그인"],
        "description": "사실 기반 - 로드맵",
    },
    {
        "query": "김철수 매니저 관련 프로젝트",
        "type": "relational",
        "expected_top": ["김철수", "김철수 매니저"],
        "description": "관계 기반 - 인물 중심",
    },
    {
        "query": "GraphRAG 하이브리드 검색 구현 방법",
        "type": "factual",
        "expected_top": ["GraphRAG", "hybrid_search", "하이브리드"],
        "description": "사실 기반 - 기술 구현",
    },
    {
        "query": "BOT Suite 시너지 전략",
        "type": "exploratory",
        "expected_top": ["BOTALKS", "BOTCON", "BOT Suite"],
        "description": "탐색 - 크로스 프로젝트",
    },
]


@dataclass
class SearchConfig:
    name: str
    reranker: bool
    dynamic_weights: bool


def _relevance_score(results: list[dict], expected: list[str]) -> float:
    """결과의 관련도 점수 (0~1). top-5에 expected 키워드가 포함된 비율."""
    if not expected:
        return 0.0
    top_names = " ".join(r.get("name", "") + " " + r.get("key", "") for r in results[:5]).lower()
    hits = sum(1 for e in expected if e.lower() in top_names)
    return hits / len(expected)


def run_search(query: str, reranker: bool, dynamic_weights: bool,
               G, embeddings, notes_content, embed_fn, top_k: int = 5):
    """Run a single search with specified config."""
    from mnemo.hybrid_search import hybrid_search

    # set reranker env
    os.environ["MNEMO_USE_RERANKER"] = "true" if reranker else "false"

    # determine weights
    if dynamic_weights:
        kw, vw, gw = classify_and_weight(query)
    else:
        kw, vw, gw = 0.5, 0.3, 0.2

    query_embedding = embed_fn(query) if embed_fn else None

    t0 = time.time()
    results = hybrid_search(
        query=query, G=G, embeddings=embeddings,
        notes_content=notes_content, query_embedding=query_embedding,
        top_k=top_k,
        keyword_weight=kw, vector_weight=vw, graph_weight=gw,
    )
    elapsed = time.time() - t0

    return [
        {
            "key": r.key,
            "name": r.name,
            "score": round(r.score, 4),
            "keyword_score": round(r.keyword_score, 4),
            "vector_score": round(r.vector_score, 4),
            "graph_score": round(r.graph_score, 4),
            "entity_type": r.entity_type,
        }
        for r in results
    ], elapsed


def classify_and_weight(query: str) -> tuple[float, float, float]:
    """쿼리 타입 자동 분류 + 동적 가중치 반환."""
    from mnemo.query_classifier import classify_query, get_weights
    qtype = classify_query(query)
    return get_weights(qtype)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reranker-only", action="store_true")
    parser.add_argument("--weights-only", action="store_true")
    args = parser.parse_args()

    # load context once
    sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
    from integrated_search import _load_vault_context
    print("Loading vault context...", flush=True)
    G, embeddings, notes_content, embed_fn = _load_vault_context()
    if G is None:
        print("ERROR: Could not load graph"); sys.exit(1)
    print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    configs = []
    if args.reranker_only:
        configs = [
            SearchConfig("baseline", False, False),
            SearchConfig("reranker", True, False),
        ]
    elif args.weights_only:
        configs = [
            SearchConfig("fixed_weights", False, False),
            SearchConfig("dynamic_weights", False, True),
        ]
    else:
        configs = [
            SearchConfig("A: baseline", False, False),
            SearchConfig("B: reranker", True, False),
            SearchConfig("C: dynamic_wt", False, True),
            SearchConfig("D: reranker+dyn", True, True),
        ]

    print(f"\n{'='*70}")
    print(f"Phase 4 A/B Test — {len(TEST_QUERIES)} queries × {len(configs)} configs")
    print(f"{'='*70}\n")

    summary = {cfg.name: {"total_relevance": 0.0, "total_time": 0.0} for cfg in configs}

    for i, tq in enumerate(TEST_QUERIES, 1):
        q = tq["query"]
        qtype = tq["type"]
        expected = tq["expected_top"]
        print(f"[{i}/{len(TEST_QUERIES)}] {tq['description']}")
        print(f"  Query: {q}")
        print(f"  Type: {qtype} | Expected: {expected}")

        for cfg in configs:
            results, elapsed = run_search(
                q, cfg.reranker, cfg.dynamic_weights,
                G, embeddings, notes_content, embed_fn
            )
            rel = _relevance_score(results, expected)
            summary[cfg.name]["total_relevance"] += rel
            summary[cfg.name]["total_time"] += elapsed

            top3 = [f"{r['name'][:25]}({r['score']:.3f})" for r in results[:3]]
            marker = "✅" if rel >= 0.5 else "⚠️" if rel > 0 else "❌"
            print(f"  {cfg.name:20s} | rel={rel:.2f} {marker} | {elapsed:.3f}s | {', '.join(top3)}")

        print()

    # Final summary
    print(f"{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    n = len(TEST_QUERIES)
    for cfg in configs:
        s = summary[cfg.name]
        avg_rel = s["total_relevance"] / n
        avg_time = s["total_time"] / n
        print(f"  {cfg.name:20s} | avg_relevance={avg_rel:.3f} | avg_time={avg_time:.3f}s")

    # winner
    best = max(summary.items(), key=lambda x: x[1]["total_relevance"])
    print(f"\n🏆 Best config: {best[0]} (avg rel: {best[1]['total_relevance']/n:.3f})")

    # Save results
    out = PROJECT_ROOT / ".mnemo" / "ab_test_results.json"
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Results saved: {out}")


if __name__ == "__main__":
    main()
