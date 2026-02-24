"""FastAPI REST 서버 — Mnemo GraphRAG API (Enhanced)

Obsidian 플러그인 + 외부 앱용 REST API.
"""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

import networkx as nx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .cache import BuildCache
from .embedder import EmbeddingCache

app = FastAPI(title="Mnemo API", version="0.2.0")

# CORS — Obsidian 플러그인 localhost 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 글로벌 상태 ──────────────────────────────────────────────
_state: dict = {}

VAULT_PATH = os.environ.get("MNEMO_VAULT_PATH", "")
MEMORY_PATH = os.environ.get("MNEMO_MEMORY_PATH", "")
CACHE_DIR = os.path.join(os.environ.get("MNEMO_PROJECT_ROOT", "."), ".mnemo")


def _load_graph() -> bool:
    """캐시에서 그래프/임베딩 로드. 성공 여부 반환."""
    cache = BuildCache(CACHE_DIR)
    emb_cache = EmbeddingCache(CACHE_DIR)

    G = cache.load_graph()
    embeddings = emb_cache.load()
    stats = cache.load_stats()

    _state["graph"] = G
    _state["embeddings"] = embeddings
    _state["stats"] = stats
    _state["cache"] = cache
    _state["emb_cache"] = emb_cache

    return G is not None


def _get_graph() -> nx.DiGraph:
    G = _state.get("graph")
    if G is None:
        raise HTTPException(503, "Graph not loaded. Run `mnemo build` or POST /enrich first.")
    return G


def _notes_content(G: nx.DiGraph) -> dict[str, str]:
    """그래프 노드의 path 속성에서 노트 본문 로드 (캐시)."""
    if "notes_content" in _state:
        return _state["notes_content"]
    content: dict[str, str] = {}
    for node, data in G.nodes(data=True):
        p = data.get("path")
        if p and Path(p).exists():
            try:
                content[node] = Path(p).read_text(encoding="utf-8")[:8000]
            except Exception:
                pass
    _state["notes_content"] = content
    return content


def _relative_path(abs_path: str | None) -> str:
    """절대 경로 → 볼트 상대 경로. 개인정보 보호."""
    if not abs_path:
        return ""
    if VAULT_PATH:
        try:
            return str(Path(abs_path).relative_to(VAULT_PATH))
        except ValueError:
            pass
    return Path(abs_path).name


def _resolve_node(G: nx.DiGraph, path_or_name: str) -> str | None:
    """경로 또는 이름으로 노드 해석. 부분 매칭 지원."""
    if path_or_name in G:
        return path_or_name
    # 부분 매칭
    lower = path_or_name.lower()
    matches = [n for n in G.nodes() if lower in n.lower()]
    return matches[0] if matches else None


# ── Startup ──────────────────────────────────────────────────
def _precompute_full_layout(max_nodes: int = 500) -> None:
    """Full graph 레이아웃을 사전 계산하여 캐시.

    서버 시작 시 백그라운드로 실행하여 첫 /graph/full 요청이
    spring_layout 계산을 기다리지 않도록 한다.
    """
    G = _state.get("graph")
    if G is None:
        return

    # PageRank 상위 노드로 제한
    work = G
    if G.number_of_nodes() > max_nodes:
        pr = nx.pagerank(G)
        top = sorted(pr, key=pr.get, reverse=True)[:max_nodes]
        work = G.subgraph(top).copy()

    layout_key = f"layout_{work.number_of_nodes()}"
    if layout_key in _state:
        return  # 이미 캐시됨

    t0 = time.time()
    pos = nx.spring_layout(work, k=0.5, iterations=50, seed=42)
    if pos:
        xs = [p[0] for p in pos.values()]
        ys = [p[1] for p in pos.values()]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        rx = (max_x - min_x) or 1
        ry = (max_y - min_y) or 1
        pos = {k: ((v[0] - min_x) / rx * 1000, (v[1] - min_y) / ry * 1000) for k, v in pos.items()}
    _state[layout_key] = pos
    print(f"[Mnemo] Full layout precomputed: {work.number_of_nodes()} nodes in {time.time()-t0:.1f}s")


@app.on_event("startup")
async def startup():
    """서버 시작 시 캐시된 그래프 로드 + 레이아웃 사전 계산."""
    loaded = _load_graph()
    if loaded:
        G = _state["graph"]
        print(f"[Mnemo] Graph loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        # 백그라운드에서 full graph 레이아웃 사전 계산
        asyncio.get_event_loop().run_in_executor(None, _precompute_full_layout, 500)
    else:
        print("[Mnemo] No cached graph found. Use POST /enrich or `mnemo build`.")


# ── GET /health ──────────────────────────────────────────────
@app.get("/health")
def health():
    """서버 상태 확인."""
    G = _state.get("graph")
    return {
        "status": "ok",
        "version": app.version,
        "graph_loaded": G is not None,
        "node_count": G.number_of_nodes() if G else 0,
        "edge_count": G.number_of_edges() if G else 0,
        "vault_path": "configured" if VAULT_PATH else "not set",
    }


# ── GET /search ──────────────────────────────────────────────
@app.get("/search")
def search(
    q: str = Query(..., description="검색어"),
    mode: str = Query("hybrid", description="hybrid|vector|keyword|graph"),
    limit: int = Query(10, ge=1, le=100),
):
    """하이브리드 검색 — 키워드 + 벡터 + 그래프 구조."""
    G = _get_graph()
    embeddings = _state.get("embeddings", {})
    notes = _notes_content(G)

    if mode == "keyword":
        from .hybrid_search import keyword_match
        raw = keyword_match(q, G, notes, top_k=limit)
        results = []
        for node, score in raw:
            data = G.nodes.get(node, {})
            results.append({
                "name": data.get("name", node.rsplit("/", 1)[-1]),
                "score": round(score, 4),
                "entity_type": data.get("entity_type", "unknown"),
                "snippet": (notes.get(node, ""))[:200],
                "path": node,
            })
        return {"results": results}

    # hybrid (default) / vector / graph
    from .hybrid_search import hybrid_search

    query_embedding = None
    if mode in ("hybrid", "vector") and embeddings:
        try:
            from .embedder import get_embedding
            query_embedding = get_embedding(q)
        except Exception:
            pass

    kw_w = 0.5 if mode != "vector" else 0.0
    vec_w = 0.3 if mode != "keyword" else 0.0
    gr_w = 0.2 if mode != "vector" else 0.0
    if mode == "vector":
        kw_w, vec_w, gr_w = 0.0, 0.8, 0.2
    elif mode == "graph":
        kw_w, vec_w, gr_w = 0.3, 0.0, 0.7

    sr = hybrid_search(
        q, G, embeddings, notes,
        query_embedding=query_embedding,
        top_k=limit,
        keyword_weight=kw_w,
        vector_weight=vec_w,
        graph_weight=gr_w,
    )

    results = []
    for r in sr:
        results.append({
            "name": r.name,
            "score": r.score,
            "entity_type": r.entity_type,
            "snippet": (notes.get(r.key, ""))[:200],
            "path": r.key,
        })

    return {"results": results}


# ── GET /stats ───────────────────────────────────────────────
@app.get("/stats")
def stats():
    """그래프 통계."""
    G = _get_graph()
    from .graph_builder import graph_stats
    s = graph_stats(G)

    embeddings = _state.get("embeddings", {})
    total = G.number_of_nodes()
    embedded = sum(1 for n in G.nodes() if n in embeddings) if embeddings else 0

    return {
        "nodes": s["nodes"],
        "edges": s["edges"],
        "components": s.get("weakly_connected_components", 0),
        "density": round(s.get("density", 0), 6),
        "entity_types": s.get("entity_types", {}),
        "embedding_coverage": f"{embedded}/{total}" if total else "0/0",
        "dangling_nodes": s.get("dangling_nodes", 0),
        "edge_types": s.get("edge_types", {}),
        "top_hubs": s.get("top_hubs", [])[:5],
    }


# ── GET /note/{path:path} ───────────────────────────────────
@app.get("/note/{path:path}")
def get_note(path: str):
    """노트 상세 정보."""
    G = _get_graph()
    node = _resolve_node(G, path)
    if node is None:
        raise HTTPException(404, f"Note '{path}' not found")

    data = G.nodes[node]
    notes = _notes_content(G)

    # 연결된 노트
    related = []
    for neighbor in G.successors(node):
        edge = G.edges[node, neighbor]
        nd = G.nodes.get(neighbor, {})
        related.append({
            "name": nd.get("name", neighbor.rsplit("/", 1)[-1]),
            "path": neighbor,
            "type": nd.get("entity_type", "unknown"),
            "relation": edge.get("type", "link"),
        })
    for predecessor in G.predecessors(node):
        edge = G.edges[predecessor, node]
        nd = G.nodes.get(predecessor, {})
        related.append({
            "name": nd.get("name", predecessor.rsplit("/", 1)[-1]),
            "path": predecessor,
            "type": nd.get("entity_type", "unknown"),
            "relation": f"← {edge.get('type', 'link')}",
        })

    return {
        "name": data.get("name", node.rsplit("/", 1)[-1]),
        "path": node,
        "type": data.get("entity_type", "unknown"),
        "tags": data.get("tags", []),
        "importance": data.get("importance", 0),
        "has_frontmatter": data.get("has_frontmatter", False),
        "related": related,
        "content_preview": (notes.get(node, ""))[:500],
    }


# ── GET /neighbors/{path:path} ──────────────────────────────
@app.get("/neighbors/{path:path}")
def neighbors(
    path: str,
    depth: int = Query(1, ge=1, le=5),
    limit: int = Query(20, ge=1, le=200),
):
    """특정 노트의 이웃 노트 (N-hop)."""
    G = _get_graph()
    node = _resolve_node(G, path)
    if node is None:
        raise HTTPException(404, f"Note '{path}' not found")

    sub = nx.ego_graph(G, node, radius=depth, undirected=True)
    neighbor_list = []
    for n in sub.nodes():
        if n == node:
            continue
        nd = G.nodes.get(n, {})
        # 최단 거리 계산
        try:
            dist = nx.shortest_path_length(G.to_undirected(), node, n)
        except nx.NetworkXNoPath:
            dist = depth + 1

        # 관계 유형
        relation = ""
        if G.has_edge(node, n):
            relation = G.edges[node, n].get("type", "link")
        elif G.has_edge(n, node):
            relation = G.edges[n, node].get("type", "link")

        neighbor_list.append({
            "name": nd.get("name", n.rsplit("/", 1)[-1]),
            "path": n,
            "type": nd.get("entity_type", "unknown"),
            "relation": relation,
            "distance": dist,
        })

    neighbor_list.sort(key=lambda x: (x["distance"], x["name"]))
    return {
        "center": node,
        "depth": depth,
        "neighbors": neighbor_list[:limit],
    }


# ── GET /graph/subgraph ─────────────────────────────────────
@app.get("/graph/subgraph")
def subgraph(
    center: str = Query(..., description="노트 path"),
    depth: int = Query(2, ge=1, le=5),
):
    """특정 노트 중심 서브그래프 (D3.js 호환 포맷)."""
    G = _get_graph()
    node = _resolve_node(G, center)
    if node is None:
        raise HTTPException(404, f"Note '{center}' not found")

    sub = nx.ego_graph(G, node, radius=depth, undirected=True)

    nodes = []
    for n in sub.nodes():
        nd = G.nodes.get(n, {})
        nodes.append({
            "id": n,
            "name": nd.get("name", n.rsplit("/", 1)[-1]),
            "type": nd.get("entity_type", "unknown"),
            "tags": nd.get("tags", []),
            "is_center": n == node,
        })

    edges = []
    for u, v in sub.edges():
        ed = G.edges.get((u, v), {})
        edges.append({
            "source": u,
            "target": v,
            "type": ed.get("type", "link"),
            "weight": ed.get("weight", 1.0),
        })

    return {"nodes": nodes, "edges": edges}


# ── POST /enrich ─────────────────────────────────────────────
@app.post("/enrich")
def enrich():
    """수동 enrichment 트리거 — 볼트 파싱 → 그래프 빌드 → 캐시 저장."""
    if not VAULT_PATH:
        raise HTTPException(400, "MNEMO_VAULT_PATH not configured")

    t0 = time.time()
    try:
        from .parser import parse_vault
        from .graph_builder import build_graph, graph_stats
        from .enricher import enrich_vault

        vault = Path(VAULT_PATH)
        notes = parse_vault(vault)

        # enrichment
        plans = enrich_vault(notes)
        updated_count = len([p for p in plans if p.changes])

        # 그래프 빌드
        G = build_graph(notes, include_tag_edges=True)
        st = graph_stats(G)

        cache = BuildCache(CACHE_DIR)
        cache.save_graph(G)
        cache.save_stats(st)

        # 상태 갱신
        _state["graph"] = G
        _state["stats"] = st
        _state.pop("notes_content", None)  # 캐시 무효화

        duration = round(time.time() - t0, 2)
        return {
            "updated_count": updated_count,
            "duration": duration,
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
        }
    except Exception as e:
        raise HTTPException(500, f"Enrichment failed: {e}")


# ── GET /graph/full — 전체 그래프 (사전 계산 레이아웃) ────────
@app.get("/graph/full")
def full_graph(
    max_nodes: int = Query(500, ge=100, le=10000),
):
    """전체 그래프를 사전 계산된 레이아웃 좌표와 함께 반환.
    
    networkx spring_layout으로 좌표를 미리 계산하여 
    클라이언트는 렌더링만 수행 (실시간 시뮬레이션 불필요).
    """
    G = _get_graph()
    
    # 노드 수 제한 (PageRank 상위)
    if G.number_of_nodes() > max_nodes:
        pr = nx.pagerank(G)
        top = sorted(pr, key=pr.get, reverse=True)[:max_nodes]
        G = G.subgraph(top).copy()
    
    # 사전 레이아웃 계산 (캐시)
    layout_key = f"layout_{G.number_of_nodes()}"
    if layout_key not in _state:
        pos = nx.spring_layout(G, k=0.5, iterations=50, seed=42)
        # 좌표를 0~1000 범위로 정규화
        if pos:
            xs = [p[0] for p in pos.values()]
            ys = [p[1] for p in pos.values()]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            rx = (max_x - min_x) or 1
            ry = (max_y - min_y) or 1
            pos = {k: ((v[0] - min_x) / rx * 1000, (v[1] - min_y) / ry * 1000) for k, v in pos.items()}
        _state[layout_key] = pos
    else:
        pos = _state[layout_key]
    
    nodes = []
    for n in G.nodes():
        nd = G.nodes.get(n, {})
        p = pos.get(n, (500, 500))
        nodes.append({
            "id": n,
            "name": nd.get("name", n.rsplit("/", 1)[-1]),
            "type": nd.get("entity_type", "unknown"),
            "x": round(p[0], 1),
            "y": round(p[1], 1),
            "degree": G.degree(n),
        })
    
    edges = []
    for u, v in G.edges():
        ed = G.edges.get((u, v), {})
        edges.append({
            "source": u,
            "target": v,
            "type": ed.get("type", "link"),
        })
    
    return {"nodes": nodes, "edges": edges, "layout": "precomputed"}


# ── GET /graph/clusters — 커뮤니티 기반 계층적 그래프 ─────────
@app.get("/graph/clusters")
def graph_clusters():
    """Louvain 커뮤니티 탐지 → 클러스터 단위로 그래프 반환.
    
    Level 0: 클러스터 요약 (클러스터별 대표 노드, 크기, 주요 타입)
    """
    G = _get_graph()
    UG = G.to_undirected()
    
    try:
        from networkx.algorithms.community import louvain_communities
        communities = louvain_communities(UG, seed=42, resolution=1.0)
    except Exception:
        # fallback: connected components
        communities = list(nx.connected_components(UG))
    
    # 클러스터 정보 수집
    clusters = []
    for i, comm in enumerate(sorted(communities, key=len, reverse=True)):
        sub = G.subgraph(comm)
        # 대표 노드 (degree 가장 높은 노드)
        hub = max(comm, key=lambda n: G.degree(n))
        hub_data = G.nodes.get(hub, {})
        
        # 타입 분포
        types = {}
        for n in comm:
            t = G.nodes.get(n, {}).get("entity_type", "unknown")
            types[t] = types.get(t, 0) + 1
        dominant_type = max(types, key=types.get) if types else "unknown"
        
        # 주요 태그
        all_tags = []
        for n in comm:
            all_tags.extend(G.nodes.get(n, {}).get("tags", []))
        tag_counts = {}
        for t in all_tags:
            tag_counts[t] = tag_counts.get(t, 0) + 1
        top_tags = sorted(tag_counts, key=tag_counts.get, reverse=True)[:5]
        
        clusters.append({
            "id": f"cluster_{i}",
            "index": i,
            "size": len(comm),
            "hub": hub,
            "hub_name": hub_data.get("name", hub.rsplit("/", 1)[-1]),
            "dominant_type": dominant_type,
            "type_distribution": types,
            "top_tags": top_tags,
            "internal_edges": sub.number_of_edges(),
        })
    
    # 클러스터 간 엣지
    node_to_cluster = {}
    for i, comm in enumerate(sorted(communities, key=len, reverse=True)):
        for n in comm:
            node_to_cluster[n] = i
    
    cluster_edges = {}
    for u, v in G.edges():
        cu = node_to_cluster.get(u, -1)
        cv = node_to_cluster.get(v, -1)
        if cu != cv and cu >= 0 and cv >= 0:
            key = (min(cu, cv), max(cu, cv))
            cluster_edges[key] = cluster_edges.get(key, 0) + 1
    
    edges = [{"source": f"cluster_{s}", "target": f"cluster_{t}", "weight": w} 
             for (s, t), w in cluster_edges.items()]
    
    # 레이아웃 계산 (클러스터 그래프)
    CG = nx.Graph()
    for c in clusters:
        CG.add_node(c["id"])
    for e in edges:
        CG.add_edge(e["source"], e["target"], weight=e["weight"])
    
    pos = nx.spring_layout(CG, k=2.0, iterations=50, seed=42) if CG.nodes() else {}
    if pos:
        xs = [p[0] for p in pos.values()]
        ys = [p[1] for p in pos.values()]
        rx = (max(xs) - min(xs)) or 1
        ry = (max(ys) - min(ys)) or 1
        for c in clusters:
            p = pos.get(c["id"], (0.5, 0.5))
            c["x"] = round((p[0] - min(xs)) / rx * 1000, 1)
            c["y"] = round((p[1] - min(ys)) / ry * 1000, 1)
    
    return {"clusters": clusters, "edges": edges, "total_nodes": G.number_of_nodes()}


@app.get("/graph/cluster/{index}")
def cluster_detail(index: int, max_nodes: int = Query(200, ge=10, le=1000)):
    """특정 클러스터 내부 노드 상세 (drill-down)."""
    G = _get_graph()
    UG = G.to_undirected()
    
    try:
        from networkx.algorithms.community import louvain_communities
        communities = louvain_communities(UG, seed=42, resolution=1.0)
    except Exception:
        communities = list(nx.connected_components(UG))
    
    sorted_comms = sorted(communities, key=len, reverse=True)
    if index < 0 or index >= len(sorted_comms):
        raise HTTPException(404, f"Cluster {index} not found")
    
    comm = sorted_comms[index]
    sub = G.subgraph(comm).copy()
    
    # 노드 수 제한
    if len(comm) > max_nodes:
        pr = nx.pagerank(sub)
        top = sorted(pr, key=pr.get, reverse=True)[:max_nodes]
        sub = sub.subgraph(top).copy()
    
    # 레이아웃
    pos = nx.spring_layout(sub, k=0.8, iterations=50, seed=42)
    if pos:
        xs = [p[0] for p in pos.values()]
        ys = [p[1] for p in pos.values()]
        rx = (max(xs) - min(xs)) or 1
        ry = (max(ys) - min(ys)) or 1
        pos = {k: ((v[0] - min(xs)) / rx * 1000, (v[1] - min(ys)) / ry * 1000) for k, v in pos.items()}
    
    nodes = []
    for n in sub.nodes():
        nd = G.nodes.get(n, {})
        p = pos.get(n, (500, 500))
        nodes.append({
            "id": n,
            "name": nd.get("name", n.rsplit("/", 1)[-1]),
            "type": nd.get("entity_type", "unknown"),
            "x": round(p[0], 1),
            "y": round(p[1], 1),
            "degree": sub.degree(n),
        })
    
    edges = [{"source": u, "target": v, "type": G.edges.get((u, v), {}).get("type", "link")}
             for u, v in sub.edges()]
    
    return {"cluster_index": index, "nodes": nodes, "edges": edges, "layout": "precomputed"}


# ── Legacy endpoints (backward compat) ──────────────────────
@app.get("/api/stats")
def get_stats_legacy():
    """그래프 통계 (legacy)."""
    return stats()


@app.get("/api/neighbors/{node_name}")
def get_neighbors_legacy(node_name: str, hops: int = 2):
    """노드 이웃 탐색 (legacy)."""
    return neighbors(node_name, depth=hops)


# ── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.mnemo.api:app", host="127.0.0.1", port=8000, reload=True)
