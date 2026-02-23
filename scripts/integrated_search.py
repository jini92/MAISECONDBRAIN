"""통합 검색 — MAIBOT memory + Mnemo 볼트 결합.

memory_search 범위(MEMORY.md + memory/*.md)를 우선 검색하고,
Mnemo 볼트 검색으로 보강. 중복 제거 후 결합 출력.

Usage:
    python scripts/integrated_search.py "검색어" --top-k 5 --format json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

_memory_path = os.environ.get("MNEMO_MEMORY_PATH")
if not _memory_path:
    print("ERROR: MNEMO_MEMORY_PATH environment variable is not set."); sys.exit(1)
MEMORY_DIR = Path(_memory_path)
_maibot_root = os.environ.get("MAIBOT_ROOT")
MEMORY_MD = Path(_maibot_root) / "MEMORY.md" if _maibot_root else MEMORY_DIR.parent / "MEMORY.md"


def search_memory_files(query: str, top_k: int = 5) -> list[dict]:
    """MAIBOT memory 파일에서 키워드 검색."""
    keywords = [w.strip().lower() for w in re.split(r"[\s,]+", query) if len(w.strip()) > 1]
    if not keywords:
        return []

    files: list[Path] = []
    if MEMORY_MD.exists():
        files.append(MEMORY_MD)
    if MEMORY_DIR.exists():
        files.extend(MEMORY_DIR.glob("*.md"))

    scored = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        text_lower = text.lower()
        score = 0.0
        for kw in keywords:
            count = text_lower.count(kw)
            if kw in f.stem.lower():
                score += 3.0
            score += min(count * 0.5, 5.0)

        if score > 0:
            # snippet: frontmatter 제거 후 첫 200자
            body = text
            if body.startswith("---"):
                end = body.find("---", 3)
                if end != -1:
                    body = body[end + 3:].lstrip("\n")
            snippet = body.strip()[:200]
            scored.append({
                "name": f.stem,
                "score": round(score, 4),
                "entity_type": "memory",
                "snippet": snippet,
                "path": str(f),
                "source": "memory",
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def _load_vault_context(cache_dir: str | None = None):
    """볼트 검색에 필요한 공통 컨텍스트 로드."""
    from mnemo.cache import BuildCache
    from mnemo.embedder import EmbeddingCache

    if cache_dir is None:
        cache_dir = str(PROJECT_ROOT / ".mnemo")

    cache = BuildCache(cache_dir)
    G = cache.load_graph()
    if G is None:
        return None, {}, {}, None

    notes_content: dict[str, str] = {}
    for node, data in G.nodes(data=True):
        p = data.get("path")
        if p and Path(p).exists():
            try:
                notes_content[node] = Path(p).read_text(encoding="utf-8", errors="replace")[:5000]
            except OSError:
                pass

    emb_cache = EmbeddingCache(cache_dir)
    embeddings = emb_cache.load()

    query_embedding_fn = None
    if embeddings:
        try:
            import ollama
            import numpy as np
            def _embed(q):
                resp = ollama.embed(model="nomic-embed-text", input=q[:2000])
                return np.array(resp["embeddings"][0], dtype=np.float32)
            query_embedding_fn = _embed
        except Exception:
            pass

    return G, embeddings, notes_content, query_embedding_fn


def search_vault(query: str, top_k: int = 5, cache_dir: str | None = None,
                 dynamic_weights: bool = False) -> list[dict]:
    """Mnemo 볼트 검색 (하이브리드: 키워드 + 벡터 + 그래프).

    Args:
        dynamic_weights: True면 쿼리 타입별 가중치 자동 조절
    """
    from mnemo.hybrid_search import hybrid_search

    G, embeddings, notes_content, embed_fn = _load_vault_context(cache_dir)
    if G is None:
        return []

    query_embedding = embed_fn(query) if embed_fn else None

    # 동적 가중치
    kw_w, vec_w, graph_w = 0.5, 0.3, 0.2
    if dynamic_weights:
        try:
            from mnemo.query_classifier import classify_and_weight
            q_type, kw_w, vec_w, graph_w = classify_and_weight(query)
        except ImportError:
            pass

    results = hybrid_search(
        query=query, G=G, embeddings=embeddings,
        notes_content=notes_content, query_embedding=query_embedding,
        top_k=top_k,
        keyword_weight=kw_w, vector_weight=vec_w, graph_weight=graph_w,
    )

    output = []
    for r in results:
        node_data = G.nodes.get(r.key, {})
        p = node_data.get("path", "")
        snippet = ""
        if p and Path(p).exists():
            try:
                text = Path(p).read_text(encoding="utf-8", errors="replace")
                if text.startswith("---"):
                    end = text.find("---", 3)
                    if end != -1:
                        text = text[end + 3:].lstrip("\n")
                snippet = text.strip()[:200]
            except OSError:
                pass
        output.append({
            "key": r.key,
            "name": r.name,
            "score": round(r.score, 4),
            "entity_type": r.entity_type,
            "snippet": snippet,
            "path": p,
            "source": "vault",
        })
    return output


def graphrag_query(query: str, top_k: int = 5, cache_dir: str | None = None,
                   use_llm: bool = True) -> dict:
    """GraphRAG 쿼리 — 하이브리드 검색 + 그래프 확장 + LLM 답변 생성.

    Returns:
        {"answer": str, "sources": [...], "expanded_nodes": int}
    """
    from mnemo.graphrag import query as grag_query, get_default_llm_fn, ollama_llm_fn

    G, embeddings, notes_content, embed_fn = _load_vault_context(cache_dir)
    if G is None:
        return {"answer": "그래프를 로드할 수 없습니다.", "sources": [], "expanded_nodes": 0}

    query_embedding = embed_fn(query) if embed_fn else None
    llm_fn = ollama_llm_fn if use_llm else None

    result = grag_query(
        question=query,
        G=G,
        embeddings=embeddings,
        notes_content=notes_content,
        query_embedding=query_embedding,
        embed_fn=embed_fn,
        llm_fn=llm_fn,
        top_k=top_k,
        hops=2,
    )

    return {
        "answer": result.answer,
        "sources": result.sources,
        "graph_context": result.graph_context[:5],
        "expanded_nodes": result.expanded_nodes,
    }


def integrated_search(query: str, top_k: int = 5, fmt: str = "json",
                      dynamic_weights: bool = False):
    """memory 우선 + 볼트 보강, 중복 제거."""
    memory_results = search_memory_files(query, top_k=top_k)
    vault_results = search_vault(query, top_k=top_k, dynamic_weights=dynamic_weights)

    # 중복 제거 (memory 우선)
    seen_names = {r["name"].lower() for r in memory_results}
    # path 기반 중복도 제거
    seen_paths = set()
    for r in memory_results:
        if r["path"]:
            seen_paths.add(Path(r["path"]).resolve())

    vault_filtered = []
    for r in vault_results:
        if r["name"].lower() in seen_names:
            continue
        if r["path"]:
            rp = Path(r["path"]).resolve()
            if rp in seen_paths:
                continue
            seen_paths.add(rp)
        seen_names.add(r["name"].lower())
        vault_filtered.append(r)

    combined = memory_results + vault_filtered

    if fmt == "json":
        print(json.dumps(combined, ensure_ascii=False, indent=2))
    else:
        if memory_results:
            print(f"=== Memory Results ({len(memory_results)}) ===")
            for i, item in enumerate(memory_results, 1):
                print(f"  {i}. [{item['score']:.3f}] {item['name']}")
                if item["snippet"]:
                    print(f"     {item['snippet'][:80]}...")
            print()
        if vault_filtered:
            print(f"=== Vault Results ({len(vault_filtered)}) ===")
            for i, item in enumerate(vault_filtered, 1):
                print(f"  {i}. [{item['score']:.3f}] {item['name']} ({item['entity_type']})")
                if item["snippet"]:
                    print(f"     {item['snippet'][:80]}...")


def main():
    parser = argparse.ArgumentParser(description="Integrated memory + vault search")
    parser.add_argument("query", help="검색어")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--format", choices=["json", "text"], default="json")
    parser.add_argument("--graphrag", action="store_true", help="GraphRAG 모드 (LLM 답변 생성)")
    parser.add_argument("--no-llm", action="store_true", help="GraphRAG에서 LLM 없이 소스만 반환")
    parser.add_argument("--dynamic-weights", action="store_true",
                        help="쿼리 타입별 동적 가중치 (factual/relational/exploratory)")
    args = parser.parse_args()

    if args.graphrag:
        result = graphrag_query(args.query, args.top_k, use_llm=not args.no_llm)
        if args.format == "json":
            print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            print(f"=== GraphRAG Answer ===")
            print(result["answer"])
            print(f"\n=== Sources ({len(result['sources'])}) ===")
            for s in result["sources"]:
                print(f"  [{s.get('combined_score', 0):.3f}] {s['name']} ({s.get('entity_type', '?')})")
            print(f"\nExpanded nodes: {result['expanded_nodes']}")
    else:
        integrated_search(args.query, args.top_k, args.format,
                          dynamic_weights=args.dynamic_weights)


if __name__ == "__main__":
    main()
