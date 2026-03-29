"""PDF parser — extracts text and metadata via pypdf."""

from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from mnemo.parser import NoteDocument

if TYPE_CHECKING:
    pass

try:
    from pypdf import PdfReader as _PdfReader  # type: ignore[import-untyped]

    _HAS_PYPDF = True
except ImportError:
    _HAS_PYPDF = False


def _pdf_date_to_iso(raw: str | None) -> str | None:
    """Convert a PDF date string (D:YYYYMMDDHHmmSS) to ISO-8601."""
    if not raw:
        return None
    cleaned = raw.replace("D:", "").split("+")[0].split("Z")[0]
    # Remove trailing timezone offset like -07'00'
    if "'" in cleaned:
        cleaned = cleaned.split("'")[0]
    # Strip to digits only for parsing
    digits = "".join(c for c in cleaned if c.isdigit())
    if not digits:
        return None
    for fmt, length in (("%Y%m%d%H%M%S", 14), ("%Y%m%d%H%M", 12), ("%Y%m%d", 8)):
        if len(digits) >= length:
            try:
                return datetime.strptime(digits[:length], fmt).isoformat()
            except ValueError:
                continue
    return None


def parse_pdf(file_path: Path, vault_root: Path | None = None) -> NoteDocument:
    """Parse a PDF file into a NoteDocument.

    Requires the ``pypdf`` library (``pip install pypdf>=4.0``).
    """
    if not _HAS_PYPDF:
        raise ImportError(
            "pypdf is required for PDF parsing. Install with: pip install 'mnemo-secondbrain[documents]'"
        )

    reader = _PdfReader(str(file_path))

    # --- extract text per page -------------------------------------------------
    pages_text: list[str] = []
    headings: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages_text.append(text)

    body = "\n\n".join(pages_text)

    # --- extract headings heuristically (lines in ALL CAPS or short bold-like) --
    for line in body.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        # Heuristic: short lines (< 120 chars) that are title-cased or UPPER
        if len(stripped) < 120 and (stripped.isupper() or stripped.istitle()):
            if len(stripped.split()) <= 12:
                headings.append(stripped)

    # --- metadata / synthetic frontmatter --------------------------------------
    meta = reader.metadata or {}
    title = str(meta.get("/Title", "") or file_path.stem).strip() or file_path.stem
    author = str(meta.get("/Author", "") or "").strip()
    created = _pdf_date_to_iso(str(meta.get("/CreationDate", "") or ""))

    frontmatter: dict = {
        "title": title,
        "type": "source",
        "format": "pdf",
        "tags": ["pdf", "external"],
    }
    if author:
        frontmatter["author"] = author
    if created:
        frontmatter["created"] = created

    # --- key ------------------------------------------------------------------
    if vault_root is not None:
        try:
            rel = file_path.resolve().relative_to(vault_root.resolve())
            key = rel.with_suffix("").as_posix()
        except ValueError:
            key = file_path.stem
    else:
        key = file_path.stem

    content = body  # PDF has no frontmatter section, so content == body
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
