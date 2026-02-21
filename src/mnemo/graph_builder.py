"""NetworkX 그래프 빌더 — Obsidian 볼트에서 인메모리 지식그래프 생성"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import networkx as nx

from .ontology import classify_entity
from .parser import NoteDocument

# 엣지 가중치
EDGE_WEIGHTS: dict[str, float] = {
    "wiki_link": 1.0,
    "related": 0.9,
    "uses": 0.8,
    "used_in": 0.8,
    "source": 0.7,
    "derived_from": 0.7,
    "applied_to": 0.7,
    "supports": 0.6,
    "contradicts": 0.6,
    "alternatives": 0.5,
    "participants": 0.5,
    "decisions": 0.5,
    "organization": 0.5,
    "tag_cooccurrence": 0.2,
}


def _build_link_resolver(notes: list[NoteDocument]) -> dict[str, str]:
    """위키링크 텍스트 → note.key 매핑 (Obsidian shortest-path 매칭).

    Obsidian은 [[파일명]] 으로 링크하면 볼트 내에서 해당 이름의 파일을 찾는다.
    동일 이름이 여러 개면 가장 짧은 경로를 선택한다.
    """
    # name → [(key, path_depth)] 매핑
    name_to_keys: dict[str, list[tuple[str, int]]] = {}
    for note in notes:
        depth = note.key.count("/")
        name_to_keys.setdefault(note.name, []).append((note.key, depth))

    # 각 이름에 대해 가장 짧은 경로 우선 정렬
    resolver: dict[str, str] = {}
    for name, candidates in name_to_keys.items():
        candidates.sort(key=lambda x: x[1])
        # 첫 번째 (가장 짧은 경로)를 기본으로
        resolver[name] = candidates[0][0]

    # key 자체도 resolver에 등록 (이미 전체 경로로 링크하는 경우)
    for note in notes:
        resolver[note.key] = note.key

    return resolver


def build_graph(
    notes: list[NoteDocument],
    include_tag_edges: bool = False,
    min_tag_cooccurrence: int = 3,
) -> nx.DiGraph:
    """NoteDocument 리스트에서 NetworkX 그래프 빌드.

    Args:
        notes: 파싱된 노트 리스트
        include_tag_edges: 태그 공유 엣지 포함 여부 (대량 엣지 주의)
        min_tag_cooccurrence: 태그 공유 최소 노트 수

    Returns:
        NetworkX DiGraph
    """
    G = nx.DiGraph()
    link_resolver = _build_link_resolver(notes)

    # 1단계: 노드 추가 (key 기반)
    for note in notes:
        entity_type = classify_entity(note)
        G.add_node(
            note.key,
            name=note.name,
            path=str(note.path),
            entity_type=entity_type,
            tags=note.tags,
            importance=note.importance,
            headings=note.headings[:5],
            checksum=note.checksum,
            has_frontmatter=bool(note.frontmatter),
        )

    # 2단계: 위키링크 엣지
    for note in notes:
        for link in note.wiki_links:
            target_key = link_resolver.get(link, link)
            G.add_edge(
                note.key,
                target_key,
                type="wiki_link",
                weight=EDGE_WEIGHTS["wiki_link"],
            )
            if target_key not in G:
                G.add_node(target_key, name=link, entity_type="unknown", dangling=True)

    # 3단계: YAML 관계 엣지
    for note in notes:
        for rel_type, targets in note.yaml_relations.items():
            weight = EDGE_WEIGHTS.get(rel_type, 0.5)
            for target in targets:
                target_key = link_resolver.get(target, target)
                G.add_edge(
                    note.key,
                    target_key,
                    type=rel_type,
                    weight=weight,
                )
                if target_key not in G:
                    G.add_node(target_key, name=target, entity_type="unknown", dangling=True)

    # 4단계: 태그 공유 엣지 (선택)
    if include_tag_edges:
        tag_notes: dict[str, list[str]] = {}
        for note in notes:
            for tag in note.tags:
                tag_notes.setdefault(str(tag), []).append(note.key)

        COMMON_TAG_THRESHOLD = 100
        rare_tags = {
            tag: members for tag, members in tag_notes.items()
            if min_tag_cooccurrence <= len(members) < COMMON_TAG_THRESHOLD
        }

        pair_shared: dict[tuple[str, str], int] = {}
        for tag, members in rare_tags.items():
            for i, a in enumerate(members):
                for b in members[i + 1:]:
                    pair_key = (min(a, b), max(a, b))
                    pair_shared[pair_key] = pair_shared.get(pair_key, 0) + 1

        MIN_SHARED = 2
        for (a, b), shared_count in pair_shared.items():
            if shared_count < MIN_SHARED:
                continue
            if not G.has_edge(a, b):
                G.add_edge(
                    a, b,
                    type="tag_shared",
                    weight=min(shared_count * 0.15, 0.8),
                    shared_tags=shared_count,
                )

    return G


def graph_stats(G: nx.DiGraph) -> dict:
    """그래프 통계 요약"""
    # 엔티티 타입 분포
    type_counts = Counter()
    dangling_count = 0
    for node, data in G.nodes(data=True):
        entity_type = data.get("entity_type", "unknown")
        type_counts[entity_type] += 1
        if data.get("dangling"):
            dangling_count += 1

    # 엣지 타입 분포
    edge_type_counts = Counter()
    for _, _, data in G.edges(data=True):
        edge_type_counts[data.get("type", "unknown")] += 1

    # 허브 노드 (degree 상위 10)
    degree_dict = dict(G.degree())
    top_hubs = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)[:10]

    # PageRank 상위 10
    try:
        pagerank = nx.pagerank(G, weight="weight")
        top_pagerank = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:10]
    except Exception:
        top_pagerank = []

    # 연결 컴포넌트 (약한 연결)
    weakly_connected = nx.number_weakly_connected_components(G)

    return {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "dangling_nodes": dangling_count,
        "entity_types": dict(type_counts.most_common()),
        "edge_types": dict(edge_type_counts.most_common()),
        "top_hubs": top_hubs,
        "top_pagerank": top_pagerank,
        "weakly_connected_components": weakly_connected,
        "density": nx.density(G),
    }
