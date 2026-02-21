"""FastAPI REST 서버 — Mnemo GraphRAG API"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .cache import BuildCache
from .embedder import EmbeddingCache
from .graph_builder import graph_stats

app = FastAPI(title="Mnemo API", version="0.1.0")

# 글로벌 상태 (서버 시작 시 로드)
_state: dict = {}


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    hops: int = 2
    alpha: float = 0.6
    beta: float = 0.4


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    expanded_nodes: int


class BuildRequest(BaseModel):
    vault_path: str
    memory_path: str | None = None
    incremental: bool = True


class NeighborRequest(BaseModel):
    hops: int = 2


def load_state(cache_dir: str = ".mnemo"):
    """캐시에서 그래프/임베딩 로드"""
    cache = BuildCache(cache_dir)
    emb_cache = EmbeddingCache(cache_dir)

    G = cache.load_graph()
    embeddings = emb_cache.load()
    stats = cache.load_stats()

    _state["graph"] = G
    _state["embeddings"] = embeddings
    _state["stats"] = stats
    _state["cache_dir"] = cache_dir

    return G is not None


@app.get("/api/stats")
def get_stats():
    """그래프 통계"""
    stats = _state.get("stats")
    if not stats:
        raise HTTPException(404, "No cached stats. Run `mnemo build` first.")
    return stats


@app.get("/api/neighbors/{node_name}")
def get_neighbors(node_name: str, hops: int = 2):
    """노드 이웃 탐색"""
    import networkx as nx
    from .graph_search import expand_from_nodes, get_subgraph_context

    G = _state.get("graph")
    if G is None:
        raise HTTPException(404, "No cached graph.")

    # 부분 매칭
    if node_name not in G:
        matches = [n for n in G.nodes() if node_name.lower() in n.lower()]
        if not matches:
            raise HTTPException(404, f"Node '{node_name}' not found")
        node_name = matches[0]

    expanded = expand_from_nodes(G, [node_name], hops=hops)
    context = get_subgraph_context(G, expanded)

    return {
        "node": node_name,
        "hops": hops,
        "neighbor_count": len(expanded) - 1,
        "neighbors": context,
    }


@app.post("/api/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest):
    """GraphRAG 질의"""
    from .graphrag import query as graphrag_query

    G = _state.get("graph")
    embeddings = _state.get("embeddings", {})

    if G is None:
        raise HTTPException(404, "No cached graph. Run `mnemo build` first.")

    # 노트 내용 로드 (그래프 노드의 path 속성에서)
    notes_content = {}
    for node, data in G.nodes(data=True):
        path = data.get("path")
        if path and Path(path).exists():
            try:
                notes_content[node] = Path(path).read_text(encoding="utf-8")[:5000]
            except Exception:
                pass

    result = graphrag_query(
        question=req.question,
        G=G,
        embeddings=embeddings,
        notes_content=notes_content,
        top_k=req.top_k,
        hops=req.hops,
        alpha=req.alpha,
        beta=req.beta,
    )

    return QueryResponse(
        answer=result.answer,
        sources=result.sources,
        expanded_nodes=result.expanded_nodes,
    )


@app.post("/api/suggest")
def suggest(note_name: str, content: str = ""):
    """관련 노트 추천"""
    G = _state.get("graph")
    if G is None:
        raise HTTPException(404, "No cached graph.")

    from .graph_search import expand_from_nodes, get_subgraph_context

    # 부분 매칭
    if note_name not in G:
        matches = [n for n in G.nodes() if note_name.lower() in n.lower()]
        if not matches:
            return {"suggestions": []}
        node_name = matches[0]
    else:
        node_name = note_name

    expanded = expand_from_nodes(G, [node_name], hops=2)
    expanded.discard(node_name)
    context = get_subgraph_context(G, expanded, max_nodes=10)

    return {"note": node_name, "suggestions": context}
