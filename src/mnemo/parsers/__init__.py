"""Unified multi-format document parser dispatcher.

Usage::

    from mnemo.parsers import parse_document, SUPPORTED_FORMATS

    doc = parse_document(Path("report.pdf"), vault_root=Path("/vault"))

Supported formats: .md, .pdf, .docx, .xlsx, .txt, .pptx
Non-.md formats require the ``documents`` optional dependency group::

    pip install 'mnemo-secondbrain[documents]'
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from mnemo.parser import NoteDocument

# Lazy imports — each parser module handles its own ImportError for missing libs.
from .markdown import parse_markdown
from .pdf import parse_pdf
from .docx import parse_docx
from .xlsx import parse_xlsx
from .txt import parse_txt
from .pptx import parse_pptx

# Public type alias for parser functions
ParserFunc = Callable[[Path, "Path | None"], NoteDocument]

PARSERS: dict[str, ParserFunc] = {
    ".md": parse_markdown,
    ".pdf": parse_pdf,
    ".docx": parse_docx,
    ".xlsx": parse_xlsx,
    ".txt": parse_txt,
    ".pptx": parse_pptx,
}

SUPPORTED_FORMATS: frozenset[str] = frozenset(PARSERS.keys())


def parse_document(file_path: Path, vault_root: Path | None = None) -> NoteDocument:
    """Parse a document of any supported format into a NoteDocument.

    Dispatches to the appropriate format-specific parser based on file extension.

    Args:
        file_path: Path to the document file.
        vault_root: Optional vault root for computing relative keys.

    Returns:
        A ``NoteDocument`` instance.

    Raises:
        ValueError: If the file extension is not supported.
        ImportError: If the required library for the format is not installed.
    """
    suffix = file_path.suffix.lower()
    parser = PARSERS.get(suffix)
    if not parser:
        raise ValueError(
            f"Unsupported format: '{suffix}'. "
            f"Supported formats: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )
    return parser(file_path, vault_root)


__all__ = [
    "parse_document",
    "parse_markdown",
    "parse_pdf",
    "parse_docx",
    "parse_xlsx",
    "parse_txt",
    "parse_pptx",
    "SUPPORTED_FORMATS",
    "PARSERS",
    "NoteDocument",
]
