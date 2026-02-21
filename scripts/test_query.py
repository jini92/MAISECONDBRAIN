"""GraphRAG 하이브리드 검색 테스트"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

import numpy as np
from mnemo.cache import BuildCache
from mnemo.embedder import EmbeddingCache
from mnemo.graphrag import query as graphrag_query

CACHE_DIR = ".mnemo"

# 로드
cache = BuildCache(CACHE_DIR)
emb_cache = EmbeddingCache(CACHE_DIR)

G = cache.load_graph()
embeddings = emb_cache.load()
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"Embeddings: {len(embeddings)}")

# 노트 내용
from pathlib import Path
notes_content = {}
for node, data in G.nodes(data=True):
    path = data.get("path")
    if path and Path(path).exists():
        try:
            notes_content[node] = Path(path).read_text(encoding="utf-8")[:3000]
        except Exception:
            pass

# Ollama로 질문 임베딩
import ollama
def embed_query(text):
    resp = ollama.embed(model="nomic-embed-text", input=text[:2000])
    return np.array(resp["embeddings"][0], dtype=np.float32)

# 테스트 질문들
questions = [
    "GraphRAG와 관련된 프로젝트는?",
    "MAIOSS에서 보안 관련 작업 내역",
    "베트남 화장품 사업 현황",
    "옵시디언 플러그인 개발",
]

for q in questions:
    print(f"\n{'='*60}")
    print(f"Q: {q}")
    print(f"{'='*60}")
    
    qe = embed_query(q)
    result = graphrag_query(
        question=q,
        G=G,
        embeddings=embeddings,
        notes_content=notes_content,
        query_embedding=qe,
        top_k=5,
        hops=2,
    )
    
    print(f"Sources ({result.expanded_nodes} nodes expanded):")
    for src in result.sources:
        print(f"  [{src['name']}] type={src['entity_type']} score={src['combined_score']}")
