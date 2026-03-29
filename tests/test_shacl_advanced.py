"""Advanced SHACL graph-level validation tests.

Tests for circular dependency detection, cardinality constraints,
dangling reference detection, semantic consistency, and inverse
relation inference.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

import networkx as nx

from mnemo.ontology_shapes import (
    ShapeViolation,
    check_cardinality_constraints,
    check_circular_dependencies,
    check_dangling_references,
    check_missing_inverse_relations,
    check_semantic_consistency,
    validate_graph_advanced,
)


# ── Helpers ──────────────────────────────────────────────────────────────


def _make_graph() -> nx.DiGraph:
    """Create an empty DiGraph for testing."""
    return nx.DiGraph()


def _add_node(G: nx.DiGraph, key: str, entity_type: str = "concept", **attrs) -> None:
    G.add_node(key, entity_type=entity_type, **attrs)


def _add_edge(G: nx.DiGraph, src: str, dst: str, relation: str) -> None:
    G.add_edge(src, dst, relation=relation)


# ── 1. Circular Dependency Detection ────────────────────────────────────


class TestCircularDependencies:
    def test_no_cycle_returns_empty(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "concept")
        _add_edge(G, "A", "B", "derived_from")
        assert check_circular_dependencies(G) == []

    def test_simple_cycle_detected(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "concept")
        _add_edge(G, "A", "B", "derived_from")
        _add_edge(G, "B", "A", "derived_from")

        violations = check_circular_dependencies(G)
        assert len(violations) > 0
        assert all(v.rule == "circular-dependency" for v in violations)
        assert all(v.severity == "warning" for v in violations)
        # The cycle path should mention both nodes
        paths = [v.actual for v in violations]
        assert any("A" in p and "B" in p for p in paths)

    def test_three_node_cycle(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "concept")
        _add_node(G, "C", "concept")
        _add_edge(G, "A", "B", "uses")
        _add_edge(G, "B", "C", "uses")
        _add_edge(G, "C", "A", "uses")

        violations = check_circular_dependencies(G)
        assert len(violations) > 0
        assert violations[0].field == "uses"

    def test_non_dependency_relation_ignored(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "concept")
        _add_edge(G, "A", "B", "related")
        _add_edge(G, "B", "A", "related")

        # "related" is not in _DEPENDENCY_RELATIONS
        violations = check_circular_dependencies(G)
        assert len(violations) == 0


# ── 2. Cardinality Constraints ──────────────────────────────────────────


class TestCardinalityConstraints:
    def test_person_with_role_passes(self) -> None:
        G = _make_graph()
        _add_node(G, "alice", "person", role="engineer")
        assert check_cardinality_constraints(G) == []

    def test_person_with_organization_passes(self) -> None:
        G = _make_graph()
        _add_node(G, "alice", "person", organization="ACME")
        assert check_cardinality_constraints(G) == []

    def test_person_without_role_or_org_warns(self) -> None:
        G = _make_graph()
        _add_node(G, "alice", "person")

        violations = check_cardinality_constraints(G)
        assert len(violations) == 1
        assert violations[0].rule == "cardinality-violation"
        assert violations[0].severity == "warning"
        assert "person" in violations[0].message

    def test_decision_with_two_fields_passes(self) -> None:
        G = _make_graph()
        _add_node(G, "d1", "decision", chosen="option A", rationale="cost")
        assert check_cardinality_constraints(G) == []

    def test_decision_with_one_field_warns(self) -> None:
        G = _make_graph()
        _add_node(G, "d1", "decision", chosen="option A")

        violations = check_cardinality_constraints(G)
        assert len(violations) == 1
        assert violations[0].rule == "cardinality-violation"
        assert "1/2" in violations[0].actual

    def test_unrelated_type_ignored(self) -> None:
        G = _make_graph()
        _add_node(G, "t1", "tool")
        assert check_cardinality_constraints(G) == []


# ── 3. Dangling Reference Detection ────────────────────────────────────


class TestDanglingReferences:
    def test_no_dangling_returns_empty(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "tool")
        _add_edge(G, "A", "B", "uses")
        assert check_dangling_references(G) == []

    def test_dangling_flag_detected(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "unknown", dangling=True)
        _add_edge(G, "A", "B", "uses")

        violations = check_dangling_references(G)
        assert len(violations) == 1
        assert violations[0].node == "B"
        assert violations[0].rule == "dangling-reference"
        assert "A" in violations[0].actual

    def test_unknown_entity_type_detected(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "orphan", "unknown")
        _add_edge(G, "A", "orphan", "uses")

        violations = check_dangling_references(G)
        assert len(violations) == 1
        assert violations[0].node == "orphan"

    def test_dangling_ref_type_detected(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "ghost", "dangling_ref")

        violations = check_dangling_references(G)
        assert len(violations) == 1
        assert violations[0].node == "ghost"

    def test_multiple_referrers_listed(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "concept")
        _add_node(G, "C", "concept")
        _add_node(G, "target", "unknown")
        _add_edge(G, "A", "target", "uses")
        _add_edge(G, "B", "target", "uses")
        _add_edge(G, "C", "target", "uses")

        violations = check_dangling_references(G)
        assert len(violations) == 1
        # All referrers should be mentioned
        msg = violations[0].actual
        assert "A" in msg
        assert "B" in msg
        assert "C" in msg


# ── 4. Semantic Consistency ─────────────────────────────────────────────


class TestSemanticConsistency:
    """Semantic consistency tests use MultiDiGraph to allow parallel edges.

    The production graph uses DiGraph where a second add_edge overwrites
    the first, but MultiDiGraph is needed to model a node that both
    supports AND contradicts the same target simultaneously.
    """

    @staticmethod
    def _make_multi() -> nx.MultiDiGraph:
        return nx.MultiDiGraph()

    def test_no_contradiction_returns_empty(self) -> None:
        G = self._make_multi()
        G.add_node("A", entity_type="concept")
        G.add_node("B", entity_type="concept")
        G.add_edge("A", "B", relation="supports")
        assert check_semantic_consistency(G) == []

    def test_supports_and_contradicts_same_target_is_error(self) -> None:
        G = self._make_multi()
        G.add_node("A", entity_type="concept")
        G.add_node("B", entity_type="concept")
        G.add_edge("A", "B", relation="supports")
        G.add_edge("A", "B", relation="contradicts")

        violations = check_semantic_consistency(G)
        assert len(violations) == 1
        assert violations[0].severity == "error"
        assert violations[0].rule == "semantic-contradiction"
        assert violations[0].node == "A"
        assert violations[0].actual == "B"

    def test_supports_and_contradicts_different_targets_ok(self) -> None:
        G = self._make_multi()
        G.add_node("A", entity_type="concept")
        G.add_node("B", entity_type="concept")
        G.add_node("C", entity_type="concept")
        G.add_edge("A", "B", relation="supports")
        G.add_edge("A", "C", relation="contradicts")
        assert check_semantic_consistency(G) == []

    def test_multiple_contradictions(self) -> None:
        G = self._make_multi()
        G.add_node("A", entity_type="insight")
        G.add_node("B", entity_type="concept")
        G.add_node("C", entity_type="decision")
        G.add_edge("A", "B", relation="supports")
        G.add_edge("A", "B", relation="contradicts")
        G.add_edge("A", "C", relation="supports")
        G.add_edge("A", "C", relation="contradicts")

        violations = check_semantic_consistency(G)
        assert len(violations) == 2
        targets = {v.actual for v in violations}
        assert targets == {"B", "C"}


# ── 5. Missing Inverse Relations ────────────────────────────────────────


class TestMissingInverseRelations:
    def test_no_inverse_needed_returns_empty(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept")
        _add_node(G, "B", "concept")
        _add_edge(G, "A", "B", "related")  # No inverse defined
        assert check_missing_inverse_relations(G) == []

    def test_uses_without_used_in_reports_info(self) -> None:
        G = _make_graph()
        _add_node(G, "proj", "project")
        _add_node(G, "tool", "tool")
        _add_edge(G, "proj", "tool", "uses")

        violations = check_missing_inverse_relations(G)
        assert len(violations) == 1
        assert violations[0].severity == "info"
        assert violations[0].rule == "missing-inverse-relation"
        assert violations[0].node == "tool"
        assert violations[0].field == "used_in"

    def test_bidirectional_uses_passes(self) -> None:
        G = _make_graph()
        _add_node(G, "proj", "project")
        _add_node(G, "tool", "tool")
        _add_edge(G, "proj", "tool", "uses")
        _add_edge(G, "tool", "proj", "used_in")
        assert check_missing_inverse_relations(G) == []

    def test_supports_without_supported_by(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "insight")
        _add_node(G, "B", "concept")
        _add_edge(G, "A", "B", "supports")

        violations = check_missing_inverse_relations(G)
        assert len(violations) == 1
        assert violations[0].field == "supported_by"


# ── 6. Integration: validate_graph_advanced ─────────────────────────────


class TestValidateGraphAdvanced:
    def test_clean_graph_returns_empty(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "concept", role="x")
        _add_node(G, "B", "tool")
        assert validate_graph_advanced(G) == []

    def test_combines_all_checks(self) -> None:
        # Use MultiDiGraph to allow parallel edges for semantic contradiction test
        G = nx.MultiDiGraph()
        G.add_node("A", entity_type="concept")
        G.add_node("B", entity_type="concept")
        # Circular dependency
        G.add_edge("A", "B", relation="derived_from")
        G.add_edge("B", "A", relation="derived_from")
        # Dangling reference
        G.add_node("orphan", entity_type="unknown")
        G.add_edge("A", "orphan", relation="uses")
        # Semantic contradiction (needs MultiDiGraph for parallel edges)
        G.add_node("C", entity_type="concept")
        G.add_edge("A", "C", relation="supports")
        G.add_edge("A", "C", relation="contradicts")

        violations = validate_graph_advanced(G)
        rules = {v.rule for v in violations}
        assert "circular-dependency" in rules
        assert "dangling-reference" in rules
        assert "semantic-contradiction" in rules

    def test_returns_flat_list_of_shape_violations(self) -> None:
        G = _make_graph()
        _add_node(G, "A", "person")  # Missing role/org -> cardinality

        violations = validate_graph_advanced(G)
        assert all(isinstance(v, ShapeViolation) for v in violations)
