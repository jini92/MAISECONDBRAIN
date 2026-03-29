"""Lineage graph extraction for ontology-focused upstream/downstream views."""

from __future__ import annotations

import heapq
from collections import defaultdict, deque
from typing import Literal
from urllib.parse import unquote

import networkx as nx

LineageDirection = Literal["upstream", "downstream", "both"]
RelationMode = Literal["target_upstream", "target_downstream", "bidirectional"]

LINEAGE_EDGE_TYPES: tuple[str, ...] = (
    "source",
    "derived_from",
    "uses",
    "used_in",
    "applied_to",
    "decisions",
    "supports",
    "contradicts",
    "alternatives",
    "wiki_link",
    "related",
)

LINEAGE_RELATION_MODE: dict[str, RelationMode] = {
    "source": "target_upstream",
    "derived_from": "target_upstream",
    "uses": "target_upstream",
    "used_in": "target_downstream",
    "applied_to": "target_downstream",
    "decisions": "target_downstream",
    "supports": "target_upstream",
    "contradicts": "bidirectional",
    "alternatives": "bidirectional",
    "wiki_link": "bidirectional",
    "related": "bidirectional",
}

LINEAGE_EDGE_PRIORITY: dict[str, int] = {
    edge_type: index for index, edge_type in enumerate(LINEAGE_EDGE_TYPES)
}

_ROLE_PRIORITY = {"center": 0, "upstream": 1, "downstream": 2, "bridge": 3}


def _normalize_ref(value: str | None) -> str:
    text = unquote(str(value or "")).strip()
    if not text:
        return ""
    text = text.replace("\\", "/")
    while "//" in text:
        text = text.replace("//", "/")
    if text.lower().endswith(".md"):
        text = text[:-3]
    return text.lower().strip("/")


def _stem_from_pathish(value: str | None) -> str:
    normalized = _normalize_ref(value)
    if not normalized:
        return ""
    return normalized.rsplit("/", 1)[-1]


def _node_aliases(
    G: nx.DiGraph,
    node: str,
    *,
    vault_path: str | None = None,
) -> set[str]:
    data = G.nodes.get(node, {})
    aliases = {
        _normalize_ref(node),
        _normalize_ref(f"{node}.md"),
        _stem_from_pathish(node),
        _stem_from_pathish(f"{node}.md"),
    }

    name = data.get("name") or node.rsplit("/", 1)[-1]
    aliases.add(_normalize_ref(name))
    aliases.add(_normalize_ref(f"{name}.md"))

    path = data.get("path")
    if path:
        aliases.add(_normalize_ref(path))
        aliases.add(_stem_from_pathish(path))
        aliases.add(_stem_from_pathish(f"{path}"))

        if vault_path:
            vault_norm = _normalize_ref(vault_path)
            path_norm = _normalize_ref(path)
            prefix = f"{vault_norm}/"
            if vault_norm and path_norm.startswith(prefix):
                rel = path_norm[len(prefix):]
                aliases.add(rel)
                aliases.add(rel.removesuffix(".md"))
                aliases.add(_stem_from_pathish(rel))

    return {alias for alias in aliases if alias}


def _candidate_sort_key(node: str) -> tuple[int, int, str]:
    return (node.count("/"), len(node), node.lower())


def _entity_priority(entity_type: str | None) -> int:
    priorities = {
        "project": 9,
        "concept": 8,
        "tool": 7,
        "source": 7,
        "decision": 6,
        "insight": 6,
        "event": 5,
        "person": 5,
        "note": 2,
        "unknown": 0,
    }
    return priorities.get(str(entity_type or "unknown"), 1)


def _stub_penalty(path_value: str | None) -> int:
    normalized = _normalize_ref(path_value)
    return 18 if any(fragment in normalized for fragment in ("/stub/", "/??/")) else 0


def _match_score(
    G: nx.DiGraph,
    node: str,
    query: str,
    *,
    vault_path: str | None = None,
) -> tuple[int, int, int, str] | None:
    data = G.nodes.get(node, {})
    aliases = _node_aliases(G, node, vault_path=vault_path)
    path_value = str(data.get("path", "") or "")
    name_value = str(data.get("name", "") or node.rsplit("/", 1)[-1])
    normalized_node = _normalize_ref(node)
    normalized_path = _normalize_ref(path_value)
    normalized_name = _normalize_ref(name_value)
    basename = _stem_from_pathish(path_value) or _stem_from_pathish(node)

    exact_pathish = {
        alias
        for alias in aliases
        if "/" in alias or alias == normalized_node or alias == normalized_path
    }

    match_kind = None
    base = -1
    if query in exact_pathish:
        match_kind = "exact-path"
        base = 120
    elif query == normalized_name or query == basename:
        match_kind = "exact-name"
        base = 108
    elif any(alias.endswith(f"/{query}") for alias in aliases if "/" in alias):
        match_kind = "path-suffix"
        base = 92
    elif query in normalized_name or query in basename:
        match_kind = "name-contains"
        base = 52
    elif any(query in alias for alias in aliases):
        match_kind = "path-contains"
        base = 34
    else:
        return None

    score = base + _entity_priority(data.get("entity_type")) - _stub_penalty(path_value)
    return (score, _entity_priority(data.get("entity_type")), -_stub_penalty(path_value), match_kind)


def _rank_candidates(
    G: nx.DiGraph,
    node_ref: str,
    *,
    vault_path: str | None = None,
) -> tuple[str, list[tuple[tuple[int, int, int, str], str]]]:
    query = _normalize_ref(node_ref)
    if not query:
        return query, []

    candidates: list[tuple[tuple[int, int, int, str], str]] = []
    for node in sorted(G.nodes(), key=_candidate_sort_key):
        score = _match_score(G, node, query, vault_path=vault_path)
        if score is not None:
            candidates.append((score, node))

    candidates.sort(
        key=lambda item: (-item[0][0], -item[0][1], -item[0][2], _candidate_sort_key(item[1]))
    )
    return query, candidates


def _is_ambiguous_candidate_set(
    query: str,
    candidates: list[tuple[tuple[int, int, int, str], str]],
) -> bool:
    if len(candidates) < 2:
        return False

    best_score, _ = candidates[0]
    next_score, _ = candidates[1]
    best_kind = best_score[3]
    next_kind = next_score[3]
    diff = best_score[0] - next_score[0]

    if best_kind == "exact-path":
        return False
    if best_kind == "exact-name" and next_kind == "exact-name":
        return diff < 8
    if best_kind == "path-suffix" and next_kind in {"path-suffix", "exact-name"}:
        return diff < 8
    if best_kind in {"name-contains", "path-contains"}:
        if len(query) < 6:
            return False
        return diff < 8
    return False


def list_disambiguation_candidates(
    G: nx.DiGraph,
    node_ref: str,
    *,
    vault_path: str | None = None,
    limit: int = 5,
) -> list[dict[str, str | int]]:
    query, candidates = _rank_candidates(G, node_ref, vault_path=vault_path)
    if not _is_ambiguous_candidate_set(query, candidates):
        return []

    result: list[dict[str, str | int]] = []
    for score, node in candidates[:limit]:
        data = G.nodes.get(node, {})
        result.append(
            {
                "id": node,
                "name": str(data.get("name", node.rsplit("/", 1)[-1])),
                "path": str(data.get("path", node)),
                "entity_type": str(data.get("entity_type", "unknown")),
                "match_kind": score[3],
                "score": int(score[0]),
            }
        )
    return result


def resolve_node_key(
    G: nx.DiGraph,
    node_ref: str,
    *,
    vault_path: str | None = None,
) -> str | None:
    """Resolve a note key from node id, relative path, absolute path, or note name.

    Exact path/name matches are preferred. Low-confidence fuzzy contains matches are only
    accepted when they are clearly better than the alternatives; otherwise return None.
    """
    query, candidates = _rank_candidates(G, node_ref, vault_path=vault_path)
    if not query or not candidates:
        return None

    best_score, best_node = candidates[0]
    match_kind = best_score[3]

    if match_kind in {"name-contains", "path-contains"}:
        if len(query) < 6:
            return None
        minimum_score = 60 if match_kind == "name-contains" else 50
        if best_score[0] < minimum_score:
            return None
        if len(candidates) > 1 and best_score[0] - candidates[1][0][0] < 8:
            return None

    if _is_ambiguous_candidate_set(query, candidates):
        return None

    return best_node


def _canonical_lineage_edge(
    source: str,
    target: str,
    edge_data: dict,
) -> dict | None:
    edge_type = str(edge_data.get("type", ""))
    if edge_type not in LINEAGE_RELATION_MODE:
        return None

    mode = LINEAGE_RELATION_MODE[edge_type]
    weight = float(edge_data.get("weight", 1.0))
    if mode == "target_upstream":
        lineage_source, lineage_target = target, source
    else:
        lineage_source, lineage_target = source, target

    return {
        "source": lineage_source,
        "target": lineage_target,
        "type": edge_type,
        "weight": weight,
    }


def _sorted_neighbors(items: list[tuple[str, dict]]) -> list[tuple[str, dict]]:
    return sorted(
        items,
        key=lambda item: (
            LINEAGE_EDGE_PRIORITY.get(item[1]["type"], len(LINEAGE_EDGE_PRIORITY)),
            item[0].lower(),
            item[1]["source"].lower(),
            item[1]["target"].lower(),
        ),
    )


def _lineage_adjacency(
    G: nx.DiGraph,
) -> tuple[dict[str, list[tuple[str, dict]]], dict[str, list[tuple[str, dict]]]]:
    upstream: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    downstream: dict[str, list[tuple[str, dict]]] = defaultdict(list)

    for source, target, edge_data in G.edges(data=True):
        lineage_edge = _canonical_lineage_edge(source, target, edge_data)
        if lineage_edge is None:
            continue

        edge_type = lineage_edge["type"]
        mode = LINEAGE_RELATION_MODE[edge_type]
        canonical_source = lineage_edge["source"]
        canonical_target = lineage_edge["target"]

        if mode == "bidirectional":
            upstream[canonical_source].append((canonical_target, lineage_edge))
            upstream[canonical_target].append((canonical_source, lineage_edge))
            downstream[canonical_source].append((canonical_target, lineage_edge))
            downstream[canonical_target].append((canonical_source, lineage_edge))
        else:
            downstream[canonical_source].append((canonical_target, lineage_edge))
            upstream[canonical_target].append((canonical_source, lineage_edge))

    return (
        {node: _sorted_neighbors(items) for node, items in upstream.items()},
        {node: _sorted_neighbors(items) for node, items in downstream.items()},
    )


def _merge_role(current: str, incoming: str) -> str:
    if current == incoming or current == "center":
        return current
    if incoming == "center":
        return incoming
    return "bridge"


def _walk_lineage(
    adjacency: dict[str, list[tuple[str, dict]]],
    center: str,
    *,
    max_depth: int,
    role: Literal["upstream", "downstream"],
    node_meta: dict[str, dict[str, int | str]],
    included: set[str],
) -> None:
    seen: dict[str, int] = {center: 0}
    queue: deque[tuple[str, int]] = deque([(center, 0)])

    while queue:
        current, depth = queue.popleft()
        if depth >= max_depth:
            continue

        for neighbor, _ in adjacency.get(current, []):
            next_depth = depth + 1
            previous = seen.get(neighbor)
            if previous is not None and previous <= next_depth:
                continue

            seen[neighbor] = next_depth
            included.add(neighbor)
            existing = node_meta.get(neighbor)
            if existing is None:
                node_meta[neighbor] = {"depth": next_depth, "lineage_role": role}
            else:
                existing["depth"] = min(int(existing["depth"]), next_depth)
                existing["lineage_role"] = _merge_role(str(existing["lineage_role"]), role)
            queue.append((neighbor, next_depth))


def build_lineage_view(
    G: nx.DiGraph,
    center: str,
    *,
    depth: int = 2,
    direction: LineageDirection = "both",
    entity_types: list[str] | None = None,
) -> dict:
    """Build a deterministic lineage view centered on ontology relations.

    Parameters
    ----------
    entity_types:
        When provided, only include nodes whose ``entity_type`` matches one of
        the given strings.  The *center* node is always included regardless.
    """
    if center not in G:
        raise KeyError(center)

    upstream_adj, downstream_adj = _lineage_adjacency(G)
    node_meta: dict[str, dict[str, int | str]] = {
        center: {"depth": 0, "lineage_role": "center"}
    }
    included = {center}

    if direction in ("upstream", "both"):
        _walk_lineage(
            upstream_adj,
            center,
            max_depth=depth,
            role="upstream",
            node_meta=node_meta,
            included=included,
        )

    if direction in ("downstream", "both"):
        _walk_lineage(
            downstream_adj,
            center,
            max_depth=depth,
            role="downstream",
            node_meta=node_meta,
            included=included,
        )

    # Apply entity_type filter — center is always kept.
    if entity_types is not None:
        allowed = set(entity_types)
        filtered = set()
        for node in included:
            if node == center:
                continue
            etype = G.nodes.get(node, {}).get("entity_type", "unknown")
            if etype not in allowed:
                filtered.add(node)
        included -= filtered
        for node in filtered:
            node_meta.pop(node, None)

    nodes = []
    for node in sorted(
        included,
        key=lambda item: (
            int(node_meta[item]["depth"]),
            _ROLE_PRIORITY.get(str(node_meta[item]["lineage_role"]), 99),
            item.lower(),
        ),
    ):
        data = G.nodes.get(node, {})
        nodes.append(
            {
                "id": node,
                "name": data.get("name", node.rsplit("/", 1)[-1]),
                "path": node,
                "entity_type": data.get("entity_type", "unknown"),
                "depth": int(node_meta[node]["depth"]),
                "lineage_role": str(node_meta[node]["lineage_role"]),
            }
        )

    edge_map: dict[tuple[str, str, str], dict] = {}
    for source, target, edge_data in G.edges(data=True):
        lineage_edge = _canonical_lineage_edge(source, target, edge_data)
        if lineage_edge is None:
            continue
        if lineage_edge["source"] not in included or lineage_edge["target"] not in included:
            continue
        key = (lineage_edge["source"], lineage_edge["target"], lineage_edge["type"])
        if key not in edge_map:
            edge_map[key] = lineage_edge

    edges = [
        edge_map[key]
        for key in sorted(
            edge_map,
            key=lambda item: (
                LINEAGE_EDGE_PRIORITY.get(item[2], len(LINEAGE_EDGE_PRIORITY)),
                item[0].lower(),
                item[1].lower(),
                item[2],
            ),
        )
    ]

    return {
        "center": center,
        "direction": direction,
        "depth": depth,
        "nodes": nodes,
        "edges": edges,
    }


def build_weighted_lineage_view(
    G: nx.DiGraph,
    center: str,
    *,
    depth: int = 2,
    direction: LineageDirection = "both",
    entity_types: list[str] | None = None,
) -> dict:
    """Build a lineage view using Dijkstra-like weighted exploration.

    Edges with higher ``weight`` values represent stronger connections.
    The algorithm converts weights to costs (``1 / weight``) so that
    stronger connections are explored first.  When all weights are equal
    the result is equivalent to BFS order.

    The returned dict matches the shape of :func:`build_lineage_view`
    with an extra ``"weighted"`` flag and paths sorted by cumulative
    weight (strongest first).
    """
    if center not in G:
        raise KeyError(center)

    upstream_adj, downstream_adj = _lineage_adjacency(G)

    node_meta: dict[str, dict] = {
        center: {"depth": 0, "lineage_role": "center", "cumulative_weight": 0.0}
    }
    included = {center}

    def _dijkstra_walk(
        adjacency: dict[str, list[tuple[str, dict]]],
        role: Literal["upstream", "downstream"],
    ) -> None:
        # Priority queue: (cost, tie-break counter, node, hop_depth)
        counter = 0
        heap: list[tuple[float, int, str, int]] = [(0.0, counter, center, 0)]
        best_cost: dict[str, float] = {center: 0.0}

        while heap:
            cost, _, current, hop_depth = heapq.heappop(heap)
            if hop_depth >= depth:
                continue
            if cost > best_cost.get(current, float("inf")):
                continue

            for neighbor, edge_info in adjacency.get(current, []):
                edge_weight = float(edge_info.get("weight", 1.0))
                # Convert weight to cost: stronger connection = lower cost.
                edge_cost = 1.0 / edge_weight if edge_weight > 0 else float("inf")
                new_cost = cost + edge_cost
                next_depth = hop_depth + 1

                if new_cost < best_cost.get(neighbor, float("inf")):
                    best_cost[neighbor] = new_cost
                    included.add(neighbor)
                    cum_weight = 1.0 / new_cost if new_cost > 0 else float("inf")
                    existing = node_meta.get(neighbor)
                    if existing is None:
                        node_meta[neighbor] = {
                            "depth": next_depth,
                            "lineage_role": role,
                            "cumulative_weight": round(cum_weight, 6),
                        }
                    else:
                        existing["depth"] = min(int(existing["depth"]), next_depth)
                        existing["lineage_role"] = _merge_role(
                            str(existing["lineage_role"]), role
                        )
                        existing["cumulative_weight"] = round(
                            max(float(existing.get("cumulative_weight", 0)), cum_weight),
                            6,
                        )
                    counter += 1
                    heapq.heappush(heap, (new_cost, counter, neighbor, next_depth))

    if direction in ("upstream", "both"):
        _dijkstra_walk(upstream_adj, "upstream")
    if direction in ("downstream", "both"):
        _dijkstra_walk(downstream_adj, "downstream")

    # Apply entity_type filter — center is always kept.
    if entity_types is not None:
        allowed = set(entity_types)
        filtered = set()
        for node in included:
            if node == center:
                continue
            etype = G.nodes.get(node, {}).get("entity_type", "unknown")
            if etype not in allowed:
                filtered.add(node)
        included -= filtered
        for node in filtered:
            node_meta.pop(node, None)

    # Sort nodes: strongest cumulative weight first (center always at top).
    nodes = []
    for node in sorted(
        included,
        key=lambda item: (
            0 if item == center else 1,
            -float(node_meta[item].get("cumulative_weight", 0)),
            int(node_meta[item]["depth"]),
            item.lower(),
        ),
    ):
        data = G.nodes.get(node, {})
        meta = node_meta[node]
        nodes.append(
            {
                "id": node,
                "name": data.get("name", node.rsplit("/", 1)[-1]),
                "path": node,
                "entity_type": data.get("entity_type", "unknown"),
                "depth": int(meta["depth"]),
                "lineage_role": str(meta["lineage_role"]),
                "cumulative_weight": float(meta.get("cumulative_weight", 0)),
            }
        )

    edge_map: dict[tuple[str, str, str], dict] = {}
    for source, target, edge_data in G.edges(data=True):
        lineage_edge = _canonical_lineage_edge(source, target, edge_data)
        if lineage_edge is None:
            continue
        if lineage_edge["source"] not in included or lineage_edge["target"] not in included:
            continue
        key = (lineage_edge["source"], lineage_edge["target"], lineage_edge["type"])
        if key not in edge_map:
            edge_map[key] = lineage_edge

    edges = [
        edge_map[key]
        for key in sorted(
            edge_map,
            key=lambda item: (
                LINEAGE_EDGE_PRIORITY.get(item[2], len(LINEAGE_EDGE_PRIORITY)),
                item[0].lower(),
                item[1].lower(),
                item[2],
            ),
        )
    ]

    return {
        "center": center,
        "direction": direction,
        "depth": depth,
        "weighted": True,
        "nodes": nodes,
        "edges": edges,
    }


def lineage_stats(lineage_view: dict) -> dict:
    """Compute statistics from a lineage view dictionary.

    Parameters
    ----------
    lineage_view:
        The dict returned by :func:`build_lineage_view` or
        :func:`build_weighted_lineage_view`.

    Returns
    -------
    dict with keys:
        ``upstream_count``, ``downstream_count``, ``bridge_count``,
        ``relation_type_distribution``, ``entity_type_distribution``,
        ``max_depth_reached``.
    """
    nodes = lineage_view.get("nodes", [])
    edges = lineage_view.get("edges", [])

    upstream_count = 0
    downstream_count = 0
    bridge_count = 0
    entity_dist: dict[str, int] = defaultdict(int)
    max_depth = 0

    for node in nodes:
        role = node.get("lineage_role", "")
        if role == "upstream":
            upstream_count += 1
        elif role == "downstream":
            downstream_count += 1
        elif role == "bridge":
            bridge_count += 1
        entity_dist[node.get("entity_type", "unknown")] += 1
        d = int(node.get("depth", 0))
        if d > max_depth:
            max_depth = d

    relation_dist: dict[str, int] = defaultdict(int)
    for edge in edges:
        relation_dist[edge.get("type", "unknown")] += 1

    return {
        "upstream_count": upstream_count,
        "downstream_count": downstream_count,
        "bridge_count": bridge_count,
        "relation_type_distribution": dict(relation_dist),
        "entity_type_distribution": dict(entity_dist),
        "max_depth_reached": max_depth,
    }
