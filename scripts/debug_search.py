"""벡터 검색 디버그"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

import numpy as np
import ollama
from mnemo.embedder import EmbeddingCache
from mnemo.vector_search import search

emb_cache = EmbeddingCache(".mnemo")
embeddings = emb_cache.load()
print(f"Embeddings: {len(embeddings)}")

# 몇 개 키 출력
keys = list(embeddings.keys())[:10]
for k in keys:
    print(f"  [{k}] dim={embeddings[k].shape}")

# 질문 임베딩
q = "MAIOSS 보안 스캐너"
resp = ollama.embed(model="nomic-embed-text", input=q)
qe = np.array(resp["embeddings"][0], dtype=np.float32)
print(f"\nQuery: {q}")
print(f"Query dim: {qe.shape}")

# 순수 벡터 검색
results = search(qe, embeddings, top_k=10)
print(f"\nTop 10 vector results:")
for name, score in results:
    print(f"  {score:.4f} [{name}]")
