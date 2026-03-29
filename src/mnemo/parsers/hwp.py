"""HWP/HWPX parser — extracts text from Korean Hangul word processor files.

HWP (legacy): OLE compound document, text in PrvText stream (UTF-16LE).
HWPX (modern): ZIP-based Open XML, text in Preview/PrvText.txt (UTF-8)
               or Contents/section*.xml with hancom namespace.

Requires ``olefile`` for .hwp files. HWPX uses stdlib ``zipfile`` only.
"""

from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from mnemo.parser import NoteDocument

try:
    import olefile as _olefile  # type: ignore[import-untyped]

    _HAS_OLEFILE = True
except ImportError:
    _HAS_OLEFILE = False

# Hancom HWPX XML namespaces
_HWPX_NS = {
    "hp": "http://www.hancom.co.kr/hwpml/2011/paragraph",
    "hs": "http://www.hancom.co.kr/hwpml/2011/section",
    "hc": "http://www.hancom.co.kr/hwpml/2011/core",
}


def _compute_key(file_path: Path, vault_root: Path | None) -> str:
    if vault_root:
        try:
            rel = file_path.relative_to(vault_root)
            return rel.with_suffix("").as_posix()
        except ValueError:
            pass
    return file_path.with_suffix("").name


def _compute_checksum(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _extract_headings_from_text(text: str) -> list[str]:
    """Heuristic heading extraction from plain text."""
    headings: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        # Korean numbered headings: 1. / 가. / (1) / 제1조 etc.
        if re.match(r"^(제?\d+[조항절]|[가-힣]\.|[0-9]+\.|[IVX]+\.|[\(\)0-9]+)", stripped):
            heading = stripped[:80]
            if heading not in headings:
                headings.append(heading)
        if len(headings) >= 10:
            break
    return headings


# ---------------------------------------------------------------------------
# HWP (OLE format) parser
# ---------------------------------------------------------------------------

def _read_hwp_prvtext(ole: "_olefile.OleFileIO") -> str:
    """Read PrvText stream from HWP OLE file (UTF-16LE encoded)."""
    if not ole.exists("PrvText"):
        return ""
    raw = ole.openstream("PrvText").read()
    return raw.decode("utf-16-le", errors="replace").strip()


def _read_hwp_metadata(ole: "_olefile.OleFileIO") -> dict[str, str]:
    """Extract metadata from HWP OLE SummaryInformation."""
    meta: dict[str, str] = {}
    try:
        info = ole.get_metadata()
        if info.title:
            meta["title"] = str(info.title)
        if info.author:
            meta["author"] = str(info.author)
        if info.subject:
            meta["subject"] = str(info.subject)
        if info.create_time:
            meta["created"] = str(info.create_time)[:10]
        if info.last_saved_time:
            meta["updated"] = str(info.last_saved_time)[:10]
    except Exception:
        pass
    return meta


def parse_hwp(file_path: Path, vault_root: Path | None = None) -> NoteDocument:
    """Parse a .hwp (OLE format) file into a NoteDocument."""
    if not _HAS_OLEFILE:
        raise ImportError(
            "olefile is required for .hwp parsing. Install with: pip install olefile"
        )

    ole = _olefile.OleFileIO(str(file_path))
    try:
        text = _read_hwp_prvtext(ole)
        meta = _read_hwp_metadata(ole)
    finally:
        ole.close()

    if not text:
        text = f"(HWP 텍스트 추출 실패: {file_path.name})"

    title = meta.get("title", file_path.stem)
    frontmatter: dict[str, object] = {
        "type": "source",
        "source_type": "hwp",
        "title": title,
    }
    if meta.get("author"):
        frontmatter["author"] = meta["author"]
    if meta.get("created"):
        frontmatter["created"] = meta["created"]

    return NoteDocument(
        path=file_path,
        name=file_path.stem,
        key=_compute_key(file_path, vault_root),
        content=text,
        body=text,
        frontmatter=frontmatter,
        wiki_links=[],
        tags=["hwp", "external"],
        headings=_extract_headings_from_text(text),
        checksum=_compute_checksum(text),
    )


# ---------------------------------------------------------------------------
# HWPX (ZIP/XML format) parser
# ---------------------------------------------------------------------------

def _read_hwpx_prvtext(zf: zipfile.ZipFile) -> str:
    """Read Preview/PrvText.txt from HWPX ZIP."""
    if "Preview/PrvText.txt" not in zf.namelist():
        return ""
    raw = zf.read("Preview/PrvText.txt")
    for enc in ("utf-8", "utf-16-le", "cp949"):
        try:
            return raw.decode(enc).strip()
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="replace").strip()


def _read_hwpx_sections(zf: zipfile.ZipFile) -> str:
    """Extract text from HWPX section XML files with namespace handling."""
    section_files = sorted(
        n for n in zf.namelist()
        if n.startswith("Contents/section") and n.endswith(".xml")
    )
    if not section_files:
        return ""

    texts: list[str] = []
    for sf in section_files:
        try:
            root = ET.fromstring(zf.read(sf))
            # Extract all text runs from hp:t elements
            for t_elem in root.iter():
                tag = t_elem.tag
                # Match {namespace}t elements (paragraph text runs)
                if tag.endswith("}t") or tag == "t":
                    if t_elem.text:
                        texts.append(t_elem.text)
        except ET.ParseError:
            continue

    return "\n".join(texts)


def parse_hwpx(file_path: Path, vault_root: Path | None = None) -> NoteDocument:
    """Parse a .hwpx (ZIP/XML format) file into a NoteDocument."""
    with zipfile.ZipFile(str(file_path)) as zf:
        # Try PrvText first (reliable), fallback to section XML
        text = _read_hwpx_prvtext(zf)
        if not text:
            text = _read_hwpx_sections(zf)

    if not text:
        text = f"(HWPX 텍스트 추출 실패: {file_path.name})"

    frontmatter: dict[str, object] = {
        "type": "source",
        "source_type": "hwpx",
        "title": file_path.stem,
    }

    return NoteDocument(
        path=file_path,
        name=file_path.stem,
        key=_compute_key(file_path, vault_root),
        content=text,
        body=text,
        frontmatter=frontmatter,
        wiki_links=[],
        tags=["hwpx", "external"],
        headings=_extract_headings_from_text(text),
        checksum=_compute_checksum(text),
    )
