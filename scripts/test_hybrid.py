"""하이브리드 검색 테스트"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

import numpy as np
import ollama
from pathlib import Path
from mnemo.cache import BuildCache
from mnemo.embedder import EmbeddingCache
from mnemo.hybrid_search import hybrid_search

CACHE_DIR = ".mnemo"
cache = BuildCache(CACHE_DIR)
emb_cache = EmbeddingCache(CACHE_DIR)
G = cache.load_graph()
embeddings = emb_cache.load()

# 노트 내용 로드
notes_content = {}
for node, data in G.nodes(data=True):
    path = data.get("path")
    if path and Path(path).exists():
        try:
            notes_content[node] = Path(path).read_text(encoding="utf-8")[:3000]
        except Exception:
            pass

print(f"Graph: {G.number_of_nodes()} nodes | Embeddings: {len(embeddings)} | Content: {len(notes_content)}")

def embed_query(text):
    resp = ollama.embed(model="nomic-embed-text", input=text[:2000])
    return np.array(resp["embeddings"][0], dtype=np.float32)

questions = [
    "MAIOSS 보안 스캐너",
    "베트남 화장품 사업",
    "GraphRAG 지식그래프",
    "옵시디언 플러그인 개발",
    "TikTok 댓글 AI",
]

for q in questions:
    print(f"\n{'='*60}")
    print(f"Q: {q}")
    qe = embed_query(q)
    results = hybrid_search(q, G, embeddings, notes_content, query_embedding=qe, top_k=7)
    for r in results:
        print(f"  {r.score:.3f} [{r.name}] kw={r.keyword_score:.2f} vec={r.vector_score:.2f} g={r.graph_score:.2f} ({r.entity_type})")
