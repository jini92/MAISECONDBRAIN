from __future__ import annotations

import importlib.util
import sys
import textwrap
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo.ontology import classify_entity
from mnemo.parser import NoteDocument, parse_note

SCRIPT_PATH = PROJECT_ROOT / "scripts" / "normalize_ontology_metadata.py"
SPEC = importlib.util.spec_from_file_location("normalize_ontology_metadata", SCRIPT_PATH)
assert SPEC and SPEC.loader
normalize = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(normalize)


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


def write_note(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")


def test_classify_entity_respects_explicit_note_type_over_name_pattern() -> None:
    note = make_note(
        "01.PROJECT/03.MAIAX/tasks/docker-환경-설정",
        "docker-환경-설정",
        frontmatter={"type": "note", "project": "MAIAX"},
        tags=["task", "maiax"],
    )

    assert classify_entity(note) == "note"


def test_update_note_backfills_source_url_and_source_type_from_body_link(tmp_path: Path) -> None:
    source_path = tmp_path / "Source Guide.md"
    write_note(
        source_path,
        """
        ---
        type: source
        ---
        Helpful reference: https://example.com/guide
        """,
    )

    note = parse_note(source_path, vault_root=tmp_path)
    assert note is not None

    indexes = normalize.build_note_indexes([note])
    changes = normalize.update_note(note, indexes, dry_run=False)
    reparsed = parse_note(source_path, vault_root=tmp_path)
    assert reparsed is not None

    assert any(change.startswith("url:+") for change in changes)
    assert reparsed.frontmatter["url"] == "https://example.com/guide"
    assert reparsed.frontmatter["source_type"] == "article"


def test_update_note_backfills_event_date_and_related_from_links(tmp_path: Path) -> None:
    project_path = tmp_path / "MAIBOT.md"
    write_note(
        project_path,
        """
        ---
        type: project
        ---
        # MAIBOT
        """,
    )
    event_path = tmp_path / "2026-03_14_Review.md"
    write_note(
        event_path,
        """
        ---
        type: event
        ---
        Review notes for [[MAIBOT]]
        """,
    )

    project_note = parse_note(project_path, vault_root=tmp_path)
    event_note = parse_note(event_path, vault_root=tmp_path)
    assert project_note is not None and event_note is not None

    indexes = normalize.build_note_indexes([project_note, event_note])
    normalize.update_note(event_note, indexes, dry_run=False)
    reparsed = parse_note(event_path, vault_root=tmp_path)
    assert reparsed is not None

    assert reparsed.frontmatter["event_date"] == "2026-03-14"
    assert reparsed.frontmatter["related"] == ["MAIBOT"]


def test_update_note_backfills_tool_category_and_used_in_from_project(tmp_path: Path) -> None:
    project_path = tmp_path / "MAIAX.md"
    write_note(
        project_path,
        """
        ---
        type: project
        ---
        # MAIAX
        """,
    )
    tool_path = tmp_path / "docker-환경-설정.md"
    write_note(
        tool_path,
        """
        ---
        type: tool
        project: MAIAX
        ---
        Docker setup checklist
        """,
    )

    project_note = parse_note(project_path, vault_root=tmp_path)
    tool_note = parse_note(tool_path, vault_root=tmp_path)
    assert project_note is not None and tool_note is not None

    indexes = normalize.build_note_indexes([project_note, tool_note])
    normalize.update_note(tool_note, indexes, dry_run=False)
    reparsed = parse_note(tool_path, vault_root=tmp_path)
    assert reparsed is not None

    assert reparsed.frontmatter["category"] == "platform"
    assert reparsed.frontmatter["used_in"] == ["MAIAX"]


def test_update_note_backfills_explicit_note_type_for_plain_notes(tmp_path: Path) -> None:
    note_path = tmp_path / "General Draft.md"
    write_note(note_path, "Just a plain note with no frontmatter.\n")

    note = parse_note(note_path, vault_root=tmp_path)
    assert note is not None

    indexes = normalize.build_note_indexes([note])
    normalize.update_note(note, indexes, dry_run=False)
    reparsed = parse_note(note_path, vault_root=tmp_path)
    assert reparsed is not None

    assert reparsed.frontmatter["type"] == "note"
