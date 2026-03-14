from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo import api as api_module
from mnemo.graph_builder import build_graph
from mnemo.lineage import build_lineage_view, list_disambiguation_candidates, resolve_node_key
from mnemo.parser import NoteDocument


def make_note(
    tmp_path: Path,
    key: str,
    name: str,
    *,
    frontmatter: dict | None = None,
    tags: list[str] | None = None,
) -> NoteDocument:
    note_path = tmp_path.joinpath(*key.split("/")).with_suffix(".md")
    note_path.parent.mkdir(parents=True, exist_ok=True)
    note_path.write_text(f"# {name}\n", encoding="utf-8")
    return NoteDocument(
        path=note_path,
        name=name,
        key=key,
        content=f"# {name}\n",
        body=f"# {name}\n",
        frontmatter=frontmatter or {},
        wiki_links=[],
        tags=tags or [],
        headings=[name],
        checksum="checksum",
    )


def build_sample_graph(tmp_path: Path):
    source = make_note(
        tmp_path,
        "03.RESOURCES/Foundations",
        "Foundations",
        frontmatter={"type": "source", "source_type": "article"},
    )
    concept = make_note(
        tmp_path,
        "02.AREA/Graph Theory",
        "Graph Theory",
        frontmatter={"type": "concept", "derived_from": ["[[Foundations]]"]},
    )
    project = make_note(
        tmp_path,
        "01.PROJECT/MAISECONDBRAIN",
        "MAISECONDBRAIN",
        frontmatter={
            "type": "project",
            "uses": ["[[Graph Theory]]"],
        },
    )
    tool = make_note(
        tmp_path,
        "03.RESOURCES/NetworkX",
        "NetworkX",
        frontmatter={"type": "tool", "category": "library", "used_in": ["[[MAISECONDBRAIN]]"]},
    )
    insight = make_note(
        tmp_path,
        "02.AREA/Lineage Pattern",
        "Lineage Pattern",
        frontmatter={
            "type": "insight",
            "source": ["[[Foundations]]"],
            "applied_to": ["[[MAISECONDBRAIN]]"],
        },
    )
    derived = make_note(
        tmp_path,
        "02.AREA/Lineage View",
        "Lineage View",
        frontmatter={"type": "concept", "derived_from": ["[[MAISECONDBRAIN]]"]},
    )
    peer = make_note(
        tmp_path,
        "01.PROJECT/Knowledge Twin",
        "Knowledge Twin",
        frontmatter={"type": "project"},
    )
    project_stub = make_note(
        tmp_path,
        "03.RESOURCES/stub/MAISECONDBRAIN",
        "MAISECONDBRAIN",
        frontmatter={"type": "note"},
    )
    noise = make_note(
        tmp_path,
        "03.RESOURCES/Noise",
        "Noise",
        frontmatter={"type": "note"},
        tags=["graph", "shared"],
    )

    notes = [source, concept, project, tool, insight, derived, peer, project_stub, noise]
    graph = build_graph(notes)
    graph.add_edge(project.key, noise.key, type="tag_shared", weight=0.95)

    return graph, {note.key: note for note in notes}


def test_resolve_node_key_handles_current_note_paths(tmp_path: Path) -> None:
    graph, notes = build_sample_graph(tmp_path)
    center = "01.PROJECT/MAISECONDBRAIN"
    absolute_path = str(notes[center].path)

    assert resolve_node_key(graph, f"{center}.md") == center
    assert resolve_node_key(graph, absolute_path) == center
    assert resolve_node_key(graph, absolute_path.replace("/", "\\")) == center
    assert resolve_node_key(graph, r"01.PROJECT\MAISECONDBRAIN.md") == center


def test_resolve_node_key_prefers_exact_semantic_match_and_rejects_weak_fuzzy(tmp_path: Path) -> None:
    graph, _ = build_sample_graph(tmp_path)

    assert resolve_node_key(graph, "MAISECONDBRAIN") == "01.PROJECT/MAISECONDBRAIN"
    assert resolve_node_key(graph, "Graph") is None


def test_build_lineage_view_filters_noise_and_orients_semantic_edges(tmp_path: Path) -> None:
    graph, _ = build_sample_graph(tmp_path)
    center = "01.PROJECT/MAISECONDBRAIN"

    payload = build_lineage_view(graph, center, depth=2, direction="both")
    nodes = {node["id"]: node for node in payload["nodes"]}
    edges = {(edge["source"], edge["target"], edge["type"]) for edge in payload["edges"]}

    assert payload["center"] == center
    assert payload["direction"] == "both"
    assert nodes[center]["lineage_role"] == "center"

    assert nodes["02.AREA/Graph Theory"]["lineage_role"] == "upstream"
    assert nodes["02.AREA/Graph Theory"]["depth"] == 1
    assert nodes["03.RESOURCES/Foundations"]["depth"] == 2
    assert nodes["03.RESOURCES/NetworkX"]["lineage_role"] == "upstream"
    assert nodes["02.AREA/Lineage Pattern"]["lineage_role"] == "upstream"
    assert nodes["02.AREA/Lineage View"]["lineage_role"] == "downstream"
    assert "03.RESOURCES/Noise" not in nodes

    assert ("02.AREA/Graph Theory", center, "uses") in edges
    assert ("03.RESOURCES/Foundations", "02.AREA/Graph Theory", "derived_from") in edges
    assert ("03.RESOURCES/NetworkX", center, "used_in") in edges
    assert ("03.RESOURCES/Noise", center, "tag_shared") not in edges
    assert all(edge_type in {"source", "derived_from", "uses", "used_in", "applied_to", "decisions"} for _, _, edge_type in edges)


def test_graph_lineage_endpoint_returns_expected_shape(tmp_path: Path) -> None:
    graph, notes = build_sample_graph(tmp_path)
    center = "01.PROJECT/MAISECONDBRAIN"
    absolute_path = str(notes[center].path)
    saved_state = dict(api_module._state)

    try:
        with TestClient(api_module.app) as client:
            api_module._state.clear()
            api_module._state["graph"] = graph

            response = client.get(
                "/graph/lineage",
                params={
                    "node": absolute_path.replace("/", "\\"),
                    "depth": 2,
                    "direction": "both",
                },
            )

        assert response.status_code == 200
        payload = response.json()
        ids = {node["id"] for node in payload["nodes"]}

        assert payload["center"] == center
        assert payload["depth"] == 2
        assert payload["direction"] == "both"
        assert "03.RESOURCES/Noise" not in ids
        assert {"id", "name", "path", "entity_type", "depth", "lineage_role"} <= set(payload["nodes"][0])
        assert {"source", "target", "type", "weight"} <= set(payload["edges"][0])
    finally:
        api_module._state.clear()
        api_module._state.update(saved_state)


def test_list_disambiguation_candidates_returns_exact_name_choices(tmp_path: Path) -> None:
    left = make_note(
        tmp_path,
        "02.AREA/Release Plan",
        "Release Plan",
        frontmatter={"type": "concept", "derived_from": ["[[Foundations]]"]},
    )
    right = make_note(
        tmp_path,
        "03.RESOURCES/Release Plan",
        "Release Plan",
        frontmatter={"type": "concept", "source": ["[[Foundations]]"]},
    )
    foundation = make_note(
        tmp_path,
        "03.RESOURCES/Foundations",
        "Foundations",
        frontmatter={"type": "source", "source_type": "article"},
    )
    graph = build_graph([left, right, foundation])

    assert resolve_node_key(graph, "Release Plan") is None
    candidates = list_disambiguation_candidates(graph, "Release Plan")
    assert len(candidates) == 2
    assert {candidate["id"] for candidate in candidates} == {left.key, right.key}
    assert all(candidate["match_kind"] == "exact-name" for candidate in candidates)


def test_graph_lineage_endpoint_returns_409_with_candidates_for_ambiguous_name(tmp_path: Path) -> None:
    left = make_note(
        tmp_path,
        "02.AREA/Release Plan",
        "Release Plan",
        frontmatter={"type": "concept", "derived_from": ["[[Foundations]]"]},
    )
    right = make_note(
        tmp_path,
        "03.RESOURCES/Release Plan",
        "Release Plan",
        frontmatter={"type": "concept", "source": ["[[Foundations]]"]},
    )
    foundation = make_note(
        tmp_path,
        "03.RESOURCES/Foundations",
        "Foundations",
        frontmatter={"type": "source", "source_type": "article"},
    )
    graph = build_graph([left, right, foundation])
    saved_state = dict(api_module._state)

    try:
        with TestClient(api_module.app) as client:
            api_module._state.clear()
            api_module._state["graph"] = graph
            response = client.get(
                "/graph/lineage",
                params={"node": "Release Plan", "depth": 2, "direction": "both"},
            )

        assert response.status_code == 409
        payload = response.json()
        assert payload["detail"]["code"] == "ambiguous_node"
        assert payload["detail"]["query"] == "Release Plan"
        assert len(payload["detail"]["candidates"]) == 2
    finally:
        api_module._state.clear()
        api_module._state.update(saved_state)
