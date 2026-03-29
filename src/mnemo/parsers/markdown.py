"""Markdown parser — delegates to the canonical parser.parse_note implementation."""

from __future__ import annotations

from pathlib import Path

from mnemo.parser import NoteDocument, parse_note


def parse_markdown(file_path: Path, vault_root: Path | None = None) -> NoteDocument:
    """Parse a Markdown file into a NoteDocument.

    Thin wrapper around the existing ``parse_note`` so that the multi-format
    dispatcher can use a uniform ``(path, vault_root) -> NoteDocument`` signature.
    """
    doc = parse_note(file_path, vault_root=vault_root)
    if doc is None:
        raise ValueError(f"Failed to parse markdown file: {file_path}")
    return doc
