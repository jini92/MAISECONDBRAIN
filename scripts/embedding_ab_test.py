#!/usr/bin/env python3
"""임베딩 모델 A/B 비교 — nomic-embed-text vs qwen3-embedding:0.6b

한국어/영어 혼합 쿼리로 벡터 검색 품질 비교.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

import numpy as np
import ollama

TEST_QUERIES = [
    {
        "query": "베트남 화장품 사업 전략",
        "expected": ["vietnam-beauty", "베트남 화장품"],
        "lang": "ko",
    },
    {
        "query": "MAIOSS 보안 스캐너 아키텍처",
        "expected": ["maioss", "MAIOSS"],
        "lang": "ko+en",
    },
    {
        "query": "AI 수익화 모델 비교 분석",
        "expected": ["수익화", "monetization", "AI"],
        "lang": "ko",
    },
    {
        "query": "삼성 엔지니어링 미팅 회의록",
        "expected": ["삼성 엔지니어링", "미팅"],
        "lang": "ko",
    },
    {
        "query": "GraphRAG hybrid search implementation",
        "expected": ["GraphRAG", "hybrid", "search"],
        "lang": "en",
    },
    {
        "query": "Obsidian 플러그인 커뮤니티 배포 계획",
        "expected": ["Obsidian", "플러그인"],
        "lang": "ko+en",
    },
    {
        "query": "김철수 매니저 프로젝트 참여",
        "expected": ["김철수"],
        "lang": "ko",
    },
    {
        "query": "TikTok 댓글 AI 분석 시스템",
        "expected": ["TikTok", "MAITOK", "Tikly"],
        "lang": "ko+en",
    },
]

MODELS = ["nomic-embed-text", "qwen3-embedding:0.6b"]


def embed(text: str, model: str) -> np.ndarray:
    resp = ollama.embed(model=model, input=text[:2000])
    return np.array(resp["embeddings"][0], dtype=np.float32)


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def main():
    from mnemo.cache import BuildCache

    cache_dir = str(PROJECT_ROOT / ".mnemo")
    cache = BuildCache(cache_dir)
    G = cache.load_graph()
    if G is None:
        print("ERROR: graph not loaded"); sys.exit(1)

    # Load existing nomic embeddings for baseline
    from mnemo.embedder import EmbeddingCache
    emb_cache = EmbeddingCache(cache_dir)
    nomic_embeddings = emb_cache.load()
    print(f"Loaded {len(nomic_embeddings)} nomic-embed-text embeddings")

    # Build content map
    notes_content = {}
    for node, data in G.nodes(data=True):
        p = data.get("path")
        if p and Path(p).exists():
            try:
                notes_content[node] = Path(p).read_text(encoding="utf-8", errors="replace")[:3000]
            except OSError:
                pass

    # Sample 50 nodes for qwen3 embedding (full rebuild too slow for test)
    sample_nodes = list(notes_content.keys())[:200]

    print(f"\nBuilding qwen3-embedding vectors for {len(sample_nodes)} sample nodes...")
    t0 = time.time()
    qwen_embeddings = {}
    for i, node in enumerate(sample_nodes):
        if i % 50 == 0 and i > 0:
            print(f"  [{i}/{len(sample_nodes)}] {time.time()-t0:.1f}s")
        content = notes_content[node][:2000]
        try:
            qwen_embeddings[node] = embed(content, "qwen3-embedding:0.6b")
        except Exception as e:
            print(f"  Error embedding {node}: {e}")
    print(f"  Done: {len(qwen_embeddings)} vectors in {time.time()-t0:.1f}s")

    dim_nomic = len(next(iter(nomic_embeddings.values()))) if nomic_embeddings else 0
    dim_qwen = len(next(iter(qwen_embeddings.values()))) if qwen_embeddings else 0
    print(f"\nDimensions: nomic={dim_nomic}, qwen3={dim_qwen}")

    # Compare search quality
    print(f"\n{'='*70}")
    print(f"Embedding A/B Test — {len(TEST_QUERIES)} queries × 2 models")
    print(f"{'='*70}\n")

    summary = {m: {"hits": 0, "total_sim": 0.0, "total_time": 0.0} for m in MODELS}

    for i, tq in enumerate(TEST_QUERIES, 1):
        q = tq["query"]
        expected = tq["expected"]
        print(f"[{i}] {q} (lang: {tq['lang']})")

        for model in MODELS:
            t0 = time.time()
            q_emb = embed(q, model)
            elapsed_embed = time.time() - t0

            # Pick the right embedding set
            embs = nomic_embeddings if model == "nomic-embed-text" else qwen_embeddings
            # common nodes only
            common = set(embs.keys()) & set(notes_content.keys())

            # Compute similarities
            scores = []
            for node in common:
                sim = cosine_sim(q_emb, embs[node])
                name = G.nodes.get(node, {}).get("name", node.rsplit("/", 1)[-1])
                scores.append((node, name, sim))

            scores.sort(key=lambda x: x[2], reverse=True)
            top5 = scores[:5]

            # Check hits
            top5_text = " ".join(n for _, n, _ in top5).lower()
            hits = sum(1 for e in expected if e.lower() in top5_text)
            hit_rate = hits / len(expected) if expected else 0

            summary[model]["hits"] += hits
            summary[model]["total_sim"] += top5[0][2] if top5 else 0
            summary[model]["total_time"] += elapsed_embed

            top3_str = ", ".join(f"{n[:25]}({s:.3f})" for _, n, s in top5[:3])
            marker = "✅" if hit_rate >= 0.5 else "⚠️" if hit_rate > 0 else "❌"
            short_model = model.split(":")[0] if ":" in model else model
            print(f"  {short_model:20s} | hits={hits}/{len(expected)} {marker} | embed={elapsed_embed:.3f}s | {top3_str}")

        print()

    # Summary
    n = len(TEST_QUERIES)
    print(f"{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    for model in MODELS:
        s = summary[model]
        total_expected = sum(len(tq["expected"]) for tq in TEST_QUERIES)
        print(f"  {model:25s} | hit_rate={s['hits']}/{total_expected} ({s['hits']/total_expected*100:.0f}%) | avg_top1_sim={s['total_sim']/n:.3f} | avg_embed_time={s['total_time']/n:.3f}s")

    # Result
    out = PROJECT_ROOT / ".mnemo" / "embedding_ab_results.json"
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nResults saved: {out}")


if __name__ == "__main__":
    main()
