"""볼트 전체 임베딩 생성 스크립트 (Ollama nomic-embed-text)"""
import sys
import time
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

from mnemo.parser import parse_vault
from mnemo.embedder import embed_notes, EmbeddingCache
from mnemo.cache import BuildCache

import os
VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
MEMORY = os.environ.get("MNEMO_MEMORY_PATH")
if not MEMORY:
    print("ERROR: MNEMO_MEMORY_PATH environment variable is not set."); sys.exit(1)
CACHE_DIR = ".mnemo"

print("Parsing vault...")
notes = parse_vault(VAULT)
memory_notes = parse_vault(MEMORY)
notes.extend(memory_notes)
print(f"  {len(notes)} notes parsed")

# 기존 임베딩 로드
emb_cache = EmbeddingCache(CACHE_DIR)
existing = emb_cache.load()
print(f"  {len(existing)} existing embeddings")

# 임베딩 생성 (Ollama, 로컬)
print(f"Embedding {len(notes) - len(existing)} new notes with Ollama nomic-embed-text...")
t0 = time.time()

try:
    embeddings = embed_notes(
        notes,
        provider="ollama",
        model="nomic-embed-text",
        existing=existing,
    )
    elapsed = time.time() - t0
    print(f"  {len(embeddings)} total embeddings ({elapsed:.1f}s)")

    # 저장
    emb_cache.save(embeddings)
    print(f"  Saved to {CACHE_DIR}/embeddings/")
except Exception as e:
    print(f"  Error: {e}")
    import traceback
    traceback.print_exc()
