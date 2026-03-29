"""Tests for expanded lineage relations, weighted paths, entity filtering, and stats."""

from __future__ import annotations

import sys
from pathlib import Path

import networkx as nx
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo.lineage import (
    LINEAGE_EDGE_PRIORITY,
    LINEAGE_EDGE_TYPES,
    LINEAGE_RELATION_MODE,
    build_lineage_view,
    build_weighted_lineage_view,
    lineage_stats,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def simple_graph() -> nx.DiGraph:
    """A small directed graph with varied edge types and entity types."""
    G = nx.DiGraph()
    G.add_node("A", name="A", entity_type="concept")
    G.add_node("B", name="B", entity_type="source")
    G.add_node("C", name="C", entity_type="project")
    G.add_node("D", name="D", entity_type="tool")
    G.add_node("E", name="E", entity_type="concept")

    # A --source--> B  (B is upstream of A from the lineage perspective)
    G.add_edge("A", "B", type="source", weight=1.0)
    # A --derived_from--> C
    G.add_edge("A", "C", type="derived_from", weight=1.0)
    # A --used_in--> D  (D is downstream of A)
    G.add_edge("A", "D", type="used_in", weight=1.0)
    # D --applied_to--> E
    G.add_edge("D", "E", type="applied_to", weight=1.0)

    return G


@pytest.fixture()
def expanded_graph() -> nx.DiGraph:
    """Graph with new relation types: supports, contradicts, alternatives, wiki_link, related."""
    G = nx.DiGraph()
    G.add_node("center", name="Center", entity_type="concept")
    G.add_node("sup", name="Supporter", entity_type="source")
    G.add_node("contra", name="Contradiction", entity_type="insight")
    G.add_node("alt", name="Alternative", entity_type="concept")
    G.add_node("wiki", name="WikiLinked", entity_type="note")
    G.add_node("rel", name="Related", entity_type="tool")

    G.add_edge("center", "sup", type="supports", weight=2.0)
    G.add_edge("center", "contra", type="contradicts", weight=1.5)
    G.add_edge("center", "alt", type="alternatives", weight=1.0)
    G.add_edge("center", "wiki", type="wiki_link", weight=0.5)
    G.add_edge("center", "rel", type="related", weight=0.8)

    return G


@pytest.fixture()
def weighted_graph() -> nx.DiGraph:
    """Graph with varying weights to test Dijkstra exploration."""
    G = nx.DiGraph()
    G.add_node("root", name="Root", entity_type="project")
    G.add_node("strong", name="Strong", entity_type="concept")
    G.add_node("weak", name="Weak", entity_type="concept")
    G.add_node("deep_strong", name="DeepStrong", entity_type="tool")
    G.add_node("deep_weak", name="DeepWeak", entity_type="tool")

    # root -> strong (weight 10: very strong)
    G.add_edge("root", "strong", type="source", weight=10.0)
    # root -> weak (weight 0.1: very weak)
    G.add_edge("root", "weak", type="source", weight=0.1)
    # strong -> deep_strong
    G.add_edge("strong", "deep_strong", type="uses", weight=5.0)
    # weak -> deep_weak
    G.add_edge("weak", "deep_weak", type="uses", weight=5.0)

    return G


# ---------------------------------------------------------------------------
# 1. Expanded Relations
# ---------------------------------------------------------------------------

class TestExpandedRelations:
    def test_new_edge_types_present(self):
        for etype in ("supports", "contradicts", "alternatives", "wiki_link", "related"):
            assert etype in LINEAGE_EDGE_TYPES
            assert etype in LINEAGE_RELATION_MODE
            assert etype in LINEAGE_EDGE_PRIORITY

    def test_relation_modes_correct(self):
        assert LINEAGE_RELATION_MODE["supports"] == "target_upstream"
        assert LINEAGE_RELATION_MODE["contradicts"] == "bidirectional"
        assert LINEAGE_RELATION_MODE["alternatives"] == "bidirectional"
        assert LINEAGE_RELATION_MODE["wiki_link"] == "bidirectional"
        assert LINEAGE_RELATION_MODE["related"] == "bidirectional"

    def test_original_types_unchanged(self):
        assert LINEAGE_RELATION_MODE["source"] == "target_upstream"
        assert LINEAGE_RELATION_MODE["derived_from"] == "target_upstream"
        assert LINEAGE_RELATION_MODE["uses"] == "target_upstream"
        assert LINEAGE_RELATION_MODE["used_in"] == "target_downstream"
        assert LINEAGE_RELATION_MODE["applied_to"] == "target_downstream"
        assert LINEAGE_RELATION_MODE["decisions"] == "target_downstream"

    def test_supports_edge_traversal(self, expanded_graph):
        view = build_lineage_view(expanded_graph, "center", depth=1, direction="upstream")
        node_ids = {n["id"] for n in view["nodes"]}
        # supports is target_upstream so "sup" is upstream of "center"
        assert "sup" in node_ids

    def test_bidirectional_edges_traversal(self, expanded_graph):
        view = build_lineage_view(expanded_graph, "center", depth=1, direction="both")
        node_ids = {n["id"] for n in view["nodes"]}
        # All bidirectional neighbors should be reachable
        for nid in ("contra", "alt", "wiki", "rel"):
            assert nid in node_ids, f"{nid} should be reachable via bidirectional edge"

    def test_expanded_edges_in_result(self, expanded_graph):
        view = build_lineage_view(expanded_graph, "center", depth=1, direction="both")
        edge_types = {e["type"] for e in view["edges"]}
        assert "supports" in edge_types
        assert "contradicts" in edge_types
        assert "alternatives" in edge_types
        assert "wiki_link" in edge_types
        assert "related" in edge_types


# ---------------------------------------------------------------------------
# 2. Weighted Path Exploration
# ---------------------------------------------------------------------------

class TestWeightedLineage:
    def test_weighted_returns_weighted_flag(self, simple_graph):
        view = build_weighted_lineage_view(simple_graph, "A", depth=2)
        assert view["weighted"] is True

    def test_weighted_includes_cumulative_weight(self, simple_graph):
        view = build_weighted_lineage_view(simple_graph, "A", depth=2)
        for node in view["nodes"]:
            assert "cumulative_weight" in node

    def test_weighted_center_has_zero_weight(self, simple_graph):
        view = build_weighted_lineage_view(simple_graph, "A", depth=2)
        center_node = next(n for n in view["nodes"] if n["id"] == "A")
        assert center_node["cumulative_weight"] == 0.0

    def test_weighted_strong_connection_first(self, weighted_graph):
        view = build_weighted_lineage_view(weighted_graph, "root", depth=2, direction="upstream")
        non_center = [n for n in view["nodes"] if n["id"] != "root"]
        if len(non_center) >= 2:
            # Nodes should be sorted by cumulative_weight descending
            weights = [n["cumulative_weight"] for n in non_center]
            assert weights == sorted(weights, reverse=True)

    def test_weighted_discovers_same_nodes_as_bfs(self, simple_graph):
        bfs_view = build_lineage_view(simple_graph, "A", depth=2)
        weighted_view = build_weighted_lineage_view(simple_graph, "A", depth=2)
        bfs_ids = {n["id"] for n in bfs_view["nodes"]}
        weighted_ids = {n["id"] for n in weighted_view["nodes"]}
        assert bfs_ids == weighted_ids

    def test_weighted_uniform_weights_match_bfs(self):
        """With uniform weights, weighted exploration finds the same nodes as BFS."""
        G = nx.DiGraph()
        for n in ("A", "B", "C", "D"):
            G.add_node(n, name=n, entity_type="concept")
        G.add_edge("A", "B", type="source", weight=1.0)
        G.add_edge("B", "C", type="source", weight=1.0)
        G.add_edge("A", "D", type="derived_from", weight=1.0)

        bfs = build_lineage_view(G, "A", depth=3)
        weighted = build_weighted_lineage_view(G, "A", depth=3)
        assert {n["id"] for n in bfs["nodes"]} == {n["id"] for n in weighted["nodes"]}

    def test_weighted_respects_depth_limit(self, weighted_graph):
        view = build_weighted_lineage_view(weighted_graph, "root", depth=1, direction="upstream")
        for node in view["nodes"]:
            assert node["depth"] <= 1

    def test_weighted_raises_on_missing_center(self, simple_graph):
        with pytest.raises(KeyError):
            build_weighted_lineage_view(simple_graph, "NONEXISTENT", depth=2)


# ---------------------------------------------------------------------------
# 3. Entity Type Filtering
# ---------------------------------------------------------------------------

class TestEntityFiltering:
    def test_filter_keeps_center_always(self, simple_graph):
        # A is a concept, filter for "tool" only -> center should still be there
        view = build_lineage_view(
            simple_graph, "A", depth=2, entity_types=["tool"]
        )
        node_ids = {n["id"] for n in view["nodes"]}
        assert "A" in node_ids  # center always included

    def test_filter_includes_matching_types(self, simple_graph):
        view = build_lineage_view(
            simple_graph, "A", depth=2, entity_types=["source"]
        )
        node_ids = {n["id"] for n in view["nodes"]}
        assert "A" in node_ids  # center
        assert "B" in node_ids  # source
        # project and tool nodes should be excluded
        assert "C" not in node_ids
        assert "D" not in node_ids

    def test_filter_excludes_non_matching_types(self, simple_graph):
        view = build_lineage_view(
            simple_graph, "A", depth=3, entity_types=["concept"]
        )
        node_ids = {n["id"] for n in view["nodes"]}
        assert "A" in node_ids
        # B=source, C=project, D=tool should be excluded
        assert "B" not in node_ids
        assert "C" not in node_ids
        assert "D" not in node_ids

    def test_no_filter_includes_all(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=3)
        node_ids = {n["id"] for n in view["nodes"]}
        assert len(node_ids) >= 3  # center + at least some neighbors

    def test_filter_edges_excluded_for_filtered_nodes(self, simple_graph):
        view = build_lineage_view(
            simple_graph, "A", depth=2, entity_types=["source"]
        )
        node_ids = {n["id"] for n in view["nodes"]}
        for edge in view["edges"]:
            assert edge["source"] in node_ids
            assert edge["target"] in node_ids

    def test_filter_on_weighted_view(self, simple_graph):
        view = build_weighted_lineage_view(
            simple_graph, "A", depth=2, entity_types=["source"]
        )
        node_ids = {n["id"] for n in view["nodes"]}
        assert "A" in node_ids
        assert "B" in node_ids
        assert "C" not in node_ids
        assert "D" not in node_ids

    def test_empty_filter_list_keeps_only_center(self, simple_graph):
        """An empty entity_types list (not None) should filter out everything except center."""
        view = build_lineage_view(simple_graph, "A", depth=2, entity_types=[])
        node_ids = {n["id"] for n in view["nodes"]}
        # Center is always kept. No other type matches an empty allowed set.
        assert "A" in node_ids
        assert len(node_ids) == 1


# ---------------------------------------------------------------------------
# 4. Lineage Stats
# ---------------------------------------------------------------------------

class TestLineageStats:
    def test_stats_upstream_downstream_counts(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=2, direction="both")
        st = lineage_stats(view)
        assert st["upstream_count"] >= 0
        assert st["downstream_count"] >= 0
        assert isinstance(st["bridge_count"], int)

    def test_stats_center_not_counted(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=2)
        st = lineage_stats(view)
        total = st["upstream_count"] + st["downstream_count"] + st["bridge_count"]
        # center is not upstream/downstream/bridge, so total < node count
        assert total < len(view["nodes"])

    def test_stats_relation_distribution(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=2)
        st = lineage_stats(view)
        dist = st["relation_type_distribution"]
        assert isinstance(dist, dict)
        # Every edge type in view should be counted
        for edge in view["edges"]:
            assert edge["type"] in dist

    def test_stats_entity_distribution(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=2)
        st = lineage_stats(view)
        dist = st["entity_type_distribution"]
        assert isinstance(dist, dict)
        total_entities = sum(dist.values())
        assert total_entities == len(view["nodes"])

    def test_stats_max_depth(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=3, direction="both")
        st = lineage_stats(view)
        assert st["max_depth_reached"] >= 0
        assert st["max_depth_reached"] <= 3

    def test_stats_empty_view(self):
        G = nx.DiGraph()
        G.add_node("solo", name="Solo", entity_type="concept")
        view = build_lineage_view(G, "solo", depth=2)
        st = lineage_stats(view)
        assert st["upstream_count"] == 0
        assert st["downstream_count"] == 0
        assert st["bridge_count"] == 0
        assert st["max_depth_reached"] == 0

    def test_stats_on_weighted_view(self, weighted_graph):
        view = build_weighted_lineage_view(weighted_graph, "root", depth=2)
        st = lineage_stats(view)
        assert "upstream_count" in st
        assert "entity_type_distribution" in st


# ---------------------------------------------------------------------------
# 5. Backward Compatibility
# ---------------------------------------------------------------------------

class TestBackwardCompatibility:
    def test_build_lineage_view_old_signature(self, simple_graph):
        """Calling without new params should work identically to before."""
        view = build_lineage_view(simple_graph, "A", depth=2, direction="both")
        assert view["center"] == "A"
        assert view["direction"] == "both"
        assert view["depth"] == 2
        assert "nodes" in view
        assert "edges" in view

    def test_key_error_on_missing_node(self, simple_graph):
        with pytest.raises(KeyError):
            build_lineage_view(simple_graph, "NONEXISTENT")

    def test_original_edge_types_still_work(self, simple_graph):
        view = build_lineage_view(simple_graph, "A", depth=2)
        edge_types = {e["type"] for e in view["edges"]}
        # The simple_graph uses source, derived_from, used_in, applied_to
        assert len(edge_types) > 0


# ---------------------------------------------------------------------------
# 6. Edge Priority Ordering
# ---------------------------------------------------------------------------

class TestEdgePriority:
    def test_new_types_ordered_after_originals(self):
        original_max = max(
            LINEAGE_EDGE_PRIORITY[t]
            for t in ("source", "derived_from", "uses", "used_in", "applied_to", "decisions")
        )
        for new_type in ("supports", "contradicts", "alternatives", "wiki_link", "related"):
            assert LINEAGE_EDGE_PRIORITY[new_type] > original_max

    def test_wiki_link_lower_priority(self):
        """wiki_link should have lower priority (higher index) than supports/contradicts."""
        assert LINEAGE_EDGE_PRIORITY["wiki_link"] > LINEAGE_EDGE_PRIORITY["supports"]
        assert LINEAGE_EDGE_PRIORITY["wiki_link"] > LINEAGE_EDGE_PRIORITY["contradicts"]
