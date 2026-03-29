"""그래프 탐색 엔진 — BFS, 서브그래프 추출, 컨텍스트 구성"""

from __future__ import annotations

import networkx as nx


def expand_from_nodes(
    G: nx.DiGraph,
    seed_nodes: list[str],
    hops: int = 2,
) -> set[str]:
    """시드 노드에서 N-hop 이웃 확장.

    Returns:
        확장된 노드 집합 (시드 포함)
    """
    expanded = set()
    for node in seed_nodes:
        if node not in G:
            continue
        sub = nx.ego_graph(G, node, radius=hops, undirected=True)
        expanded.update(sub.nodes())
    return expanded


def get_subgraph_context(
    G: nx.DiGraph,
    nodes: set[str],
    max_nodes: int = 30,
) -> list[dict]:
    """노드 집합의 컨텍스트 정보 추출.

    Returns:
        [{"name": ..., "entity_type": ..., "tags": ..., "connections": [...]}]
    """
    # PageRank로 중요도 순 정렬
    try:
        pagerank = nx.pagerank(G, weight="weight")
    except Exception:
        pagerank = {n: 1.0 for n in G.nodes()}

    sorted_nodes = sorted(
        [n for n in nodes if n in G],
        key=lambda n: pagerank.get(n, 0),
        reverse=True,
    )[:max_nodes]

    context = []
    for node in sorted_nodes:
        data = G.nodes.get(node, {})
        # 직접 연결된 엣지 정보
        connections = []
        for _, target, edge_data in G.edges(node, data=True):
            if target in nodes:
                connections.append({
                    "target": target,
                    "type": edge_data.get("type", "unknown"),
                    "weight": edge_data.get("weight", 0.5),
                })

        context.append({
            "key": node,
            "name": data.get("name", node.rsplit("/", 1)[-1]),
            "entity_type": data.get("entity_type", "unknown"),
            "tags": data.get("tags", []),
            "importance": data.get("importance", "medium"),
            "connections": connections[:10],
            "pagerank": round(pagerank.get(node, 0), 6),
        })

    return context


def find_paths(
    G: nx.DiGraph,
    source: str,
    target: str,
    max_length: int = 4,
) -> list[list[str]]:
    """두 노드 간 경로 탐색 (최단 경로 + 대안 경로)"""
    if source not in G or target not in G:
        return []

    paths = []
    try:
        # 무방향으로 변환해서 경로 탐색
        undirected = G.to_undirected()
        for path in nx.all_simple_paths(undirected, source, target, cutoff=max_length):
            paths.append(path)
            if len(paths) >= 5:  # 최대 5개 경로
                break
    except nx.NetworkXNoPath:
        pass

    return paths
