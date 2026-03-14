from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo.graph_builder import build_graph, graph_stats
from mnemo.ontology_shapes import validate_ontology_shapes
from mnemo.parser import NoteDocument


def make_note(
    key: str,
    name: str,
    *,
    frontmatter: dict | None = None,
    wiki_links: list[str] | None = None,
    tags: list[str] | None = None,
) -> NoteDocument:
    return NoteDocument(
        path=Path(f"/{key}.md"),
        name=name,
        key=key,
        content="# Test\n",
        body="# Test\n",
        frontmatter=frontmatter or {},
        wiki_links=wiki_links or [],
        tags=tags or [],
        headings=["Test"],
        checksum="checksum",
    )


def test_validate_ontology_shapes_flags_invalid_date_and_relation_target_mismatch() -> None:
    review = make_note(
        "00.DAILY/review",
        "Weekly Review",
        frontmatter={
            "type": "event",
            "event_date": "14-03-2026",
            "decisions": ["[[Python]]"],
        },
    )
    python_tool = make_note(
        "03.RESOURCES/Python",
        "Python",
        frontmatter={
            "type": "tool",
            "category": "language",
            "used_in": ["[[Mnemo]]"],
        },
    )
    mnemo = make_note(
        "01.PROJECT/Mnemo",
        "Mnemo",
        frontmatter={
            "type": "project",
            "github": "https://github.com/jini92/MAISECONDBRAIN",
            "uses": ["[[Python]]"],
        },
    )

    graph = build_graph([review, python_tool, mnemo])
    report = validate_ontology_shapes([review, python_tool, mnemo], graph)
    rules = {item["rule"] for item in report["violations"] if item["node"] == review.key}

    assert "invalid-date-format" in rules
    assert "relation-target-mismatch" in rules
    assert graph.nodes[review.key]["shape_status"] == "error"


def test_validate_ontology_shapes_populates_graph_stats_summary() -> None:
    python_tool = make_note(
        "03.RESOURCES/Python",
        "Python",
        frontmatter={
            "type": "tool",
            "category": "language",
            "used_in": ["[[Mnemo]]"],
        },
    )
    mnemo = make_note(
        "01.PROJECT/Mnemo",
        "Mnemo",
        frontmatter={
            "type": "project",
            "github": "https://github.com/jini92/MAISECONDBRAIN",
            "uses": ["[[Python]]"],
        },
    )

    graph = build_graph([python_tool, mnemo])
    report = validate_ontology_shapes([python_tool, mnemo], graph)
    stats = graph_stats(graph)

    assert report["summary"]["passed_nodes"] == 2
    assert stats["ontology_quality"]["checked_nodes"] == 2
    assert stats["ontology_quality"]["errors"] == 0
    assert stats["ontology_quality"]["warnings"] == 0


def test_validate_ontology_shapes_warns_on_missing_explicit_type() -> None:
    note = make_note(
        "03.RESOURCES/GraphRAG",
        "GraphRAG",
        frontmatter={"tags": ["graphrag", "ai"]},
    )

    graph = build_graph([note])
    report = validate_ontology_shapes([note], graph)

    assert any(item["rule"] == "missing-explicit-type" for item in report["violations"])
    assert graph.nodes[note.key]["shape_status"] == "warning"
