"""Plain text parser — reads .txt files with Korean encoding fallback."""

from __future__ import annotations

import hashlib
from pathlib import Path

from mnemo.parser import NoteDocument


def parse_txt(file_path: Path, vault_root: Path | None = None) -> NoteDocument:
    """Parse a plain text file into a NoteDocument.

    Attempts UTF-8 first, then falls back to CP949 for Korean text.
    """
    content: str | None = None
    for encoding in ("utf-8", "cp949", "latin-1"):
        try:
            content = file_path.read_text(encoding=encoding)
            break
        except (UnicodeDecodeError, OSError):
            continue

    if content is None:
        raise ValueError(f"Cannot decode text file: {file_path}")

    # --- extract headings heuristically --------------------------------------
    headings: list[str] = []
    lines = content.split("\n")
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        # Heuristic: a short non-empty line followed by a blank line or at start
        is_first = i == 0
        prev_blank = i > 0 and not lines[i - 1].strip()
        next_blank = i < len(lines) - 1 and not lines[i + 1].strip()
        if (is_first or prev_blank) and next_blank and len(stripped) < 100:
            headings.append(stripped)

    # --- synthetic frontmatter ------------------------------------------------
    # Derive a title from the first non-empty line or filename
    first_line = ""
    for line in lines:
        if line.strip():
            first_line = line.strip()
            break
    title = first_line[:80] if first_line else file_path.stem

    frontmatter: dict = {
        "title": title,
        "type": "source",
        "format": "txt",
        "tags": ["txt", "external"],
    }

    # --- key ------------------------------------------------------------------
    if vault_root is not None:
        try:
            rel = file_path.resolve().relative_to(vault_root.resolve())
            key = rel.with_suffix("").as_posix()
        except ValueError:
            key = file_path.stem
    else:
        key = file_path.stem

    body = content
    checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    return NoteDocument(
        path=file_path,
        name=file_path.stem,
        key=key,
        content=content,
        body=body,
        frontmatter=frontmatter,
        wiki_links=[],
        tags=frontmatter["tags"],
        headings=headings[:30],
        checksum=checksum,
    )
