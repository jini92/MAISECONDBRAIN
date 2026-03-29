"""Tests for multi-format parser dispatcher and individual parsers."""

from __future__ import annotations

import hashlib
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from mnemo.parser import NoteDocument
from mnemo.parsers import (
    SUPPORTED_FORMATS,
    parse_document,
    parse_markdown,
)
from mnemo.parsers.txt import parse_txt


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_dir():
    """Provide a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


@pytest.fixture
def md_file(tmp_dir: Path) -> Path:
    p = tmp_dir / "note.md"
    p.write_text(
        "---\ntitle: Test Note\ntags: [test, sample]\n---\n# Heading\nBody text with [[Link]].\n",
        encoding="utf-8",
    )
    return p


@pytest.fixture
def txt_file(tmp_dir: Path) -> Path:
    p = tmp_dir / "readme.txt"
    p.write_text("First Line Title\n\nSome body content here.\nAnother line.\n", encoding="utf-8")
    return p


@pytest.fixture
def korean_txt_file(tmp_dir: Path) -> Path:
    p = tmp_dir / "korean.txt"
    p.write_bytes("한국어 텍스트 파일\n\n본문 내용입니다.\n".encode("cp949"))
    return p


# ---------------------------------------------------------------------------
# Dispatcher tests
# ---------------------------------------------------------------------------

class TestParseDocument:
    """Tests for the unified parse_document dispatcher."""

    def test_supported_formats_contains_all(self):
        expected = {".md", ".pdf", ".docx", ".xlsx", ".txt", ".pptx", ".hwp", ".hwpx"}
        assert expected == SUPPORTED_FORMATS

    def test_unsupported_format_raises(self, tmp_dir: Path):
        p = tmp_dir / "file.xyz"
        p.write_text("data")
        with pytest.raises(ValueError, match="Unsupported format"):
            parse_document(p)

    def test_dispatch_markdown(self, md_file: Path):
        doc = parse_document(md_file)
        assert isinstance(doc, NoteDocument)
        assert doc.name == "note"
        assert "test" in doc.tags
        assert "Heading" in doc.headings

    def test_dispatch_txt(self, txt_file: Path):
        doc = parse_document(txt_file)
        assert isinstance(doc, NoteDocument)
        assert doc.frontmatter["format"] == "txt"
        assert "txt" in doc.tags

    def test_key_with_vault_root(self, txt_file: Path, tmp_dir: Path):
        doc = parse_document(txt_file, vault_root=tmp_dir)
        assert doc.key == "readme"  # relative to vault root, no extension

    def test_key_without_vault_root(self, txt_file: Path):
        doc = parse_document(txt_file, vault_root=None)
        assert doc.key == "readme"


# ---------------------------------------------------------------------------
# Markdown parser tests
# ---------------------------------------------------------------------------

class TestMarkdownParser:
    def test_parses_frontmatter(self, md_file: Path):
        doc = parse_markdown(md_file)
        assert doc.frontmatter.get("title") == "Test Note"

    def test_extracts_wiki_links(self, md_file: Path):
        doc = parse_markdown(md_file)
        assert "Link" in doc.wiki_links

    def test_extracts_headings(self, md_file: Path):
        doc = parse_markdown(md_file)
        assert "Heading" in doc.headings

    def test_computes_checksum(self, md_file: Path):
        doc = parse_markdown(md_file)
        assert len(doc.checksum) == 16

    def test_raises_on_parse_failure(self, tmp_dir: Path):
        p = tmp_dir / "bad.md"
        p.write_bytes(b"\xff\xfe" * 100)  # invalid for both utf-8 and cp949
        with pytest.raises(ValueError, match="Failed to parse"):
            parse_markdown(p)


# ---------------------------------------------------------------------------
# TXT parser tests
# ---------------------------------------------------------------------------

class TestTxtParser:
    def test_basic_parse(self, txt_file: Path):
        doc = parse_txt(txt_file)
        assert "First Line Title" in doc.body
        assert doc.frontmatter["type"] == "source"
        assert doc.frontmatter["format"] == "txt"

    def test_title_from_first_line(self, txt_file: Path):
        doc = parse_txt(txt_file)
        assert doc.frontmatter["title"] == "First Line Title"

    def test_tags(self, txt_file: Path):
        doc = parse_txt(txt_file)
        assert "txt" in doc.tags
        assert "external" in doc.tags

    def test_checksum(self, txt_file: Path):
        doc = parse_txt(txt_file)
        content = txt_file.read_text(encoding="utf-8")
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
        assert doc.checksum == expected

    def test_korean_cp949_fallback(self, korean_txt_file: Path):
        doc = parse_txt(korean_txt_file)
        assert "한국어" in doc.body

    def test_entity_type_defaults_to_source(self, txt_file: Path):
        doc = parse_txt(txt_file)
        assert doc.entity_type == "source"

    def test_heading_extraction_heuristic(self, tmp_dir: Path):
        p = tmp_dir / "headings.txt"
        p.write_text("Chapter One\n\nSome paragraph text that continues.\n\nChapter Two\n\nMore text.\n")
        doc = parse_txt(p)
        assert "Chapter One" in doc.headings
        assert "Chapter Two" in doc.headings


# ---------------------------------------------------------------------------
# PDF parser tests (mock-based — no real PDF files required)
# ---------------------------------------------------------------------------

class TestPdfParser:
    def test_import_error_when_missing(self):
        with patch("mnemo.parsers.pdf._HAS_PYPDF", False):
            from mnemo.parsers.pdf import parse_pdf
            with pytest.raises(ImportError, match="pypdf is required"):
                parse_pdf(Path("fake.pdf"))

    def test_parse_with_mock(self, tmp_dir: Path):
        """Test PDF parsing logic with a mocked PdfReader."""
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Page 1 content\nSOME HEADING"

        mock_meta = {"/Title": "Test PDF", "/Author": "Author Name", "/CreationDate": "D:20240101120000"}
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]
        mock_reader.metadata = mock_meta

        pdf_path = tmp_dir / "test.pdf"
        pdf_path.write_bytes(b"%PDF-1.4 fake")

        with patch("mnemo.parsers.pdf._HAS_PYPDF", True), \
             patch("mnemo.parsers.pdf._PdfReader", return_value=mock_reader):
            from mnemo.parsers.pdf import parse_pdf
            doc = parse_pdf(pdf_path, vault_root=tmp_dir)

        assert isinstance(doc, NoteDocument)
        assert doc.frontmatter["title"] == "Test PDF"
        assert doc.frontmatter["author"] == "Author Name"
        assert doc.frontmatter["format"] == "pdf"
        assert "pdf" in doc.tags
        assert "Page 1 content" in doc.body
        assert doc.key == "test"

    def test_pdf_date_conversion(self):
        from mnemo.parsers.pdf import _pdf_date_to_iso
        assert _pdf_date_to_iso("D:20240315143000") is not None
        assert _pdf_date_to_iso(None) is None
        assert _pdf_date_to_iso("") is None


# ---------------------------------------------------------------------------
# DOCX parser tests (mock-based)
# ---------------------------------------------------------------------------

class TestDocxParser:
    def test_import_error_when_missing(self):
        with patch("mnemo.parsers.docx._HAS_DOCX", False):
            from mnemo.parsers.docx import parse_docx
            with pytest.raises(ImportError, match="python-docx is required"):
                parse_docx(Path("fake.docx"))

    def test_parse_with_mock(self, tmp_dir: Path):
        mock_para1 = MagicMock()
        mock_para1.text = "Introduction"
        mock_para1.style = MagicMock()
        mock_para1.style.name = "Heading 1"

        mock_para2 = MagicMock()
        mock_para2.text = "Body paragraph content."
        mock_para2.style = MagicMock()
        mock_para2.style.name = "Normal"

        mock_core = MagicMock()
        mock_core.title = "My Document"
        mock_core.author = "Writer"
        mock_core.created = None

        mock_doc = MagicMock()
        mock_doc.paragraphs = [mock_para1, mock_para2]
        mock_doc.tables = []
        mock_doc.core_properties = mock_core

        docx_path = tmp_dir / "test.docx"
        docx_path.write_bytes(b"fake docx")

        with patch("mnemo.parsers.docx._HAS_DOCX", True), \
             patch("mnemo.parsers.docx._Document", return_value=mock_doc):
            from mnemo.parsers.docx import parse_docx
            doc = parse_docx(docx_path, vault_root=tmp_dir)

        assert doc.frontmatter["title"] == "My Document"
        assert "Introduction" in doc.headings
        assert "Body paragraph content." in doc.body
        assert doc.frontmatter["format"] == "docx"


# ---------------------------------------------------------------------------
# XLSX parser tests (mock-based)
# ---------------------------------------------------------------------------

class TestXlsxParser:
    def test_import_error_when_missing(self):
        with patch("mnemo.parsers.xlsx._HAS_OPENPYXL", False):
            from mnemo.parsers.xlsx import parse_xlsx
            with pytest.raises(ImportError, match="openpyxl is required"):
                parse_xlsx(Path("fake.xlsx"))

    def test_parse_with_mock(self, tmp_dir: Path):
        mock_ws = MagicMock()
        mock_ws.iter_rows.return_value = [("Name", "Score"), ("Alice", 95), ("Bob", 87)]

        mock_props = MagicMock()
        mock_props.title = "Scores"
        mock_props.creator = "Teacher"
        mock_props.created = None

        mock_wb = MagicMock()
        mock_wb.sheetnames = ["Sheet1"]
        mock_wb.__getitem__ = MagicMock(return_value=mock_ws)
        mock_wb.properties = mock_props

        xlsx_path = tmp_dir / "data.xlsx"
        xlsx_path.write_bytes(b"fake xlsx")

        with patch("mnemo.parsers.xlsx._HAS_OPENPYXL", True), \
             patch("mnemo.parsers.xlsx._load_workbook", return_value=mock_wb):
            from mnemo.parsers.xlsx import parse_xlsx
            doc = parse_xlsx(xlsx_path, vault_root=tmp_dir)

        assert doc.frontmatter["title"] == "Scores"
        assert "Sheet1" in doc.headings
        assert "Alice" in doc.body
        assert doc.frontmatter["format"] == "xlsx"


# ---------------------------------------------------------------------------
# PPTX parser tests (mock-based)
# ---------------------------------------------------------------------------

class TestPptxParser:
    def test_import_error_when_missing(self):
        with patch("mnemo.parsers.pptx._HAS_PPTX", False):
            from mnemo.parsers.pptx import parse_pptx
            with pytest.raises(ImportError, match="python-pptx is required"):
                parse_pptx(Path("fake.pptx"))

    def test_parse_with_mock(self, tmp_dir: Path):
        mock_para = MagicMock()
        mock_para.text = "Slide Title Text"

        mock_tf = MagicMock()
        mock_tf.paragraphs = [mock_para]
        mock_tf.text = "Slide Title Text"

        mock_ph_fmt = MagicMock()
        mock_ph_fmt.type = 15  # TITLE

        mock_shape = MagicMock()
        mock_shape.has_text_frame = True
        mock_shape.text_frame = mock_tf
        mock_shape.is_placeholder = True
        mock_shape.placeholder_format = mock_ph_fmt

        mock_slide = MagicMock()
        mock_slide.shapes = [mock_shape]
        mock_slide.has_notes_slide = False

        mock_core = MagicMock()
        mock_core.title = "Presentation"
        mock_core.author = "Presenter"
        mock_core.created = None

        mock_prs = MagicMock()
        mock_prs.slides = [mock_slide]
        mock_prs.core_properties = mock_core

        pptx_path = tmp_dir / "deck.pptx"
        pptx_path.write_bytes(b"fake pptx")

        import mnemo.parsers.pptx as pptx_mod
        # Inject mock _Presentation since the real lib is not installed
        with patch.object(pptx_mod, "_HAS_PPTX", True), \
             patch.object(pptx_mod, "_Presentation", create=True, return_value=mock_prs):
            doc = pptx_mod.parse_pptx(pptx_path, vault_root=tmp_dir)

        assert doc.frontmatter["title"] == "Presentation"
        assert "Slide Title Text" in doc.headings
        assert doc.frontmatter["format"] == "pptx"
        assert doc.frontmatter["slide_count"] == 1


# ---------------------------------------------------------------------------
# Frontmatter generation tests
# ---------------------------------------------------------------------------

class TestSyntheticFrontmatter:
    """Verify all non-MD parsers produce proper synthetic frontmatter."""

    def test_txt_frontmatter_structure(self, txt_file: Path):
        doc = parse_txt(txt_file)
        fm = doc.frontmatter
        assert "title" in fm
        assert fm["type"] == "source"
        assert fm["format"] == "txt"
        assert isinstance(fm["tags"], list)
        assert "external" in fm["tags"]


# ---------------------------------------------------------------------------
# graph_builder multi-format scan tests
# ---------------------------------------------------------------------------

class TestScanVaultMultiformat:
    def test_scan_md_only_default(self, tmp_dir: Path):
        (tmp_dir / "note.md").write_text("# Hello\nWorld\n", encoding="utf-8")
        (tmp_dir / "data.txt").write_text("plain text\n", encoding="utf-8")

        from mnemo.graph_builder import scan_vault_multiformat
        notes = scan_vault_multiformat(tmp_dir)
        assert len(notes) == 1
        assert notes[0].name == "note"

    def test_scan_with_txt(self, tmp_dir: Path):
        (tmp_dir / "note.md").write_text("# Hello\nWorld\n", encoding="utf-8")
        (tmp_dir / "data.txt").write_text("plain text\n", encoding="utf-8")

        from mnemo.graph_builder import scan_vault_multiformat
        notes = scan_vault_multiformat(tmp_dir, scan_formats={".md", ".txt"})
        assert len(notes) == 2
        names = {n.name for n in notes}
        assert names == {"note", "data"}

    def test_scan_excludes_dirs(self, tmp_dir: Path):
        hidden = tmp_dir / ".obsidian"
        hidden.mkdir()
        (hidden / "config.md").write_text("internal\n", encoding="utf-8")
        (tmp_dir / "real.md").write_text("# Real\n", encoding="utf-8")

        from mnemo.graph_builder import scan_vault_multiformat
        notes = scan_vault_multiformat(tmp_dir)
        assert len(notes) == 1
        assert notes[0].name == "real"

    def test_scan_nonexistent_vault_raises(self):
        from mnemo.graph_builder import scan_vault_multiformat
        with pytest.raises(FileNotFoundError):
            scan_vault_multiformat(Path("/nonexistent/vault"))
