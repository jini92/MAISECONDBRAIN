"""검색 품질 벤치마크 — 기존 vs 한국어 모델 vs Reranker"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("MNEMO_VAULT_PATH", r"C:\Users\jini9\OneDrive\Documents\JINI_SYNC")
os.environ.setdefault("MNEMO_MEMORY_PATH", r"C:\MAIBOT\memory")

from pathlib import Path
from mnemo.parser import parse_vault
from mnemo.graph_builder import build_graph
from mnemo.embedder import (
    embed_notes, embed_sbert, embed_query_sbert, _prepare_text, SBERT_MODELS,
)
from mnemo.hybrid_search import hybrid_search
from mnemo.vector_search import search as vector_search
from mnemo.reranker import Reranker

import numpy as np


TEST_QUERIES = [
    "베트남 화장품 사업",
    "knowledge graph 구축",
    "AI 수익화 전략",
    "오픈소스 보안 스캐너",
    "TikTok 댓글 분석",
]


def main():
    vault_path = os.environ["MNEMO_VAULT_PATH"]
    print(f"Parsing vault: {vault_path}")
    notes = parse_vault(vault_path)
    print(f"  → {len(notes)} notes parsed")

    # Build graph
    G = build_graph(notes)
    notes_content = {n.key: _prepare_text(n) for n in notes}

    # Prepare texts for embedding
    texts = {}
    for n in notes:
        t = _prepare_text(n)
        if len(t.strip()) >= 10:
            texts[n.key] = t

    results_md = []
    results_md.append("# T008: Search Quality Benchmark\n")
    results_md.append(f"Date: 2026-02-21\n")
    results_md.append(f"Notes in vault: {len(notes)}\n")

    # Test each model
    models_to_test = {
        "default (all-MiniLM-L6-v2)": "default",
        "korean (ko-sroberta-multitask)": "korean",
    }

    all_embeddings = {}
    for label, model_key in models_to_test.items():
        model_name = SBERT_MODELS[model_key]
        print(f"\nEmbedding with {label} ({model_name})...")
        t0 = time.time()
        embs = embed_sbert(texts, model=model_name)
        elapsed = time.time() - t0
        print(f"  → {len(embs)} embeddings in {elapsed:.1f}s")
        all_embeddings[label] = (embs, model_name)

    # Load reranker
    print("\nLoading reranker...")
    reranker = Reranker()

    results_md.append("\n## Results\n")

    for query in TEST_QUERIES:
        results_md.append(f"\n### Query: `{query}`\n")
        print(f"\n{'='*60}")
        print(f"Query: {query}")

        for label, (embs, model_name) in all_embeddings.items():
            qvec = embed_query_sbert(query, model=model_name)
            vec_results = vector_search(qvec, embs, top_k=5)
            
            results_md.append(f"\n**{label}** (vector only):\n")
            results_md.append("| # | Note | Score |")
            results_md.append("|---|------|-------|")
            print(f"\n  [{label}]")
            for i, (name, score) in enumerate(vec_results, 1):
                display = name.rsplit("/", 1)[-1][:50]
                results_md.append(f"| {i} | {display} | {score:.4f} |")
                print(f"    {i}. {display} ({score:.4f})")

        # Reranker test (using korean model embeddings)
        korean_embs, korean_model = all_embeddings["korean (ko-sroberta-multitask)"]
        qvec = embed_query_sbert(query, model=korean_model)
        vec_results = vector_search(qvec, korean_embs, top_k=30)
        
        rerank_input = [
            {"name": name.rsplit("/", 1)[-1], "key": name,
             "snippet": notes_content.get(name, "")[:500], "score": score}
            for name, score in vec_results
        ]
        reranked = reranker.rerank(query, rerank_input, top_k=5)

        results_md.append(f"\n**korean + reranker**:\n")
        results_md.append("| # | Note | Rerank Score |")
        results_md.append("|---|------|-------------|")
        print(f"\n  [korean + reranker]")
        for i, r in enumerate(reranked, 1):
            display = r["name"][:50]
            results_md.append(f"| {i} | {display} | {r['rerank_score']:.4f} |")
            print(f"    {i}. {display} ({r['rerank_score']:.4f})")

    results_md.append("\n\n## Notes\n")
    results_md.append("- Reranker: cross-encoder/ms-marco-MiniLM-L-6-v2\n")
    results_md.append("- Korean model: jhgan/ko-sroberta-multitask (768dim)\n")
    results_md.append("- Default model: all-MiniLM-L6-v2 (384dim)\n")
    results_md.append("- ⚠️ Korean model uses ~1.5GB RAM\n")

    # Write results
    docs_dir = Path(__file__).parent.parent / "docs"
    docs_dir.mkdir(exist_ok=True)
    out_path = docs_dir / "T008-search-quality.md"
    out_path.write_text("\n".join(results_md), encoding="utf-8")
    print(f"\n✅ Results written to {out_path}")


if __name__ == "__main__":
    main()
