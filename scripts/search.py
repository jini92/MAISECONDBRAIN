"""Mnemo 검색 래퍼 — CLI에서 JSON 출력으로 바로 호출 가능.

Usage:
    python scripts/search.py "검색어" --top-k 5 --format json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo.cache import BuildCache
from mnemo.embedder import EmbeddingCache
from mnemo.hybrid_search import hybrid_search


def get_snippet(path: str | None, max_chars: int = 200) -> str:
    """노트 파일에서 frontmatter 제외 첫 max_chars 글자."""
    if not path:
        return ""
    try:
        text = Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            text = text[end + 3:].lstrip("\n")
    lines = [l for l in text.split("\n") if not l.startswith("#")]
    return "\n".join(lines).strip()[:max_chars]


def search(query: str, top_k: int = 5, cache_dir: str = ".mnemo", fmt: str = "json"):
    cache = BuildCache(cache_dir)
    G = cache.load_graph()
    if G is None:
        print("Error: No cached graph. Run 'mnemo build' first.", file=sys.stderr)
        sys.exit(1)

    # 노트 내용 로드
    notes_content: dict[str, str] = {}
    for node, data in G.nodes(data=True):
        p = data.get("path")
        if p and Path(p).exists():
            try:
                notes_content[node] = Path(p).read_text(encoding="utf-8", errors="replace")[:5000]
            except OSError:
                pass

    # 임베딩 로드
    emb_cache = EmbeddingCache(cache_dir)
    embeddings = emb_cache.load()

    # 쿼리 임베딩
    query_embedding = None
    if embeddings:
        try:
            import ollama
            import numpy as np
            resp = ollama.embed(model="nomic-embed-text", input=query[:2000])
            query_embedding = np.array(resp["embeddings"][0], dtype=np.float32)
        except Exception:
            pass

    results = hybrid_search(
        query=query,
        G=G,
        embeddings=embeddings,
        notes_content=notes_content,
        query_embedding=query_embedding,
        top_k=top_k,
    )

    output = []
    for r in results:
        node_data = G.nodes.get(r.key, {})
        output.append({
            "key": r.key,
            "name": r.name,
            "score": round(r.score, 4),
            "entity_type": r.entity_type,
            "snippet": get_snippet(node_data.get("path")),
            "path": node_data.get("path", ""),
        })

    if fmt == "json":
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        for i, item in enumerate(output, 1):
            print(f"{i}. [{item['score']:.3f}] {item['name']} ({item['entity_type']})")
            if item["snippet"]:
                print(f"   {item['snippet'][:100]}...")
            print()


def main():
    parser = argparse.ArgumentParser(description="Mnemo vault search")
    parser.add_argument("query", help="검색어")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--format", choices=["json", "text"], default="json")
    parser.add_argument("--cache-dir", default=str(PROJECT_ROOT / ".mnemo"))
    args = parser.parse_args()
    search(args.query, args.top_k, args.cache_dir, args.format)


if __name__ == "__main__":
    main()
