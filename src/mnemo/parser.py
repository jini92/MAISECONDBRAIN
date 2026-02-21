"""Obsidian 볼트 마크다운 파서 — YAML frontmatter + [[위키링크]] + #태그 추출"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml


# [[링크]] 또는 [[링크|별칭]] 패턴
WIKI_LINK_RE = re.compile(r"\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|[^\]]+?)?\]\]")

# #태그 패턴 (frontmatter tags가 아닌 본문 태그)
INLINE_TAG_RE = re.compile(r"(?:^|\s)#([a-zA-Z가-힣][a-zA-Z0-9가-힣_/-]*)", re.MULTILINE)

# YAML frontmatter 구분자
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)
# Fallback for broken frontmatter (closing --- not followed by newline)
FRONTMATTER_LOOSE_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


@dataclass
class NoteDocument:
    """파싱된 Obsidian 노트"""

    path: Path
    name: str  # 파일명 (확장자 제외, 표시용)
    key: str  # 볼트 상대경로 기반 고유키 (예: "01.PROJECT/03.MAIAX/_DASHBOARD")
    content: str  # 전체 텍스트
    body: str  # frontmatter 제외 본문
    frontmatter: dict = field(default_factory=dict)
    wiki_links: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    headings: list[str] = field(default_factory=list)
    checksum: str = ""

    @property
    def entity_type(self) -> str:
        """YAML type 필드 또는 태그 기반 추론"""
        return self.frontmatter.get("type", "note")

    @property
    def importance(self) -> str:
        return self.frontmatter.get("importance", "medium")

    @property
    def yaml_relations(self) -> dict[str, list[str]]:
        """YAML에서 명시적 관계 추출"""
        relation_fields = [
            "related", "uses", "used_in", "source", "derived_from",
            "supports", "contradicts", "applied_to", "alternatives",
            "participants", "decisions", "organization",
        ]
        relations = {}
        for field_name in relation_fields:
            val = self.frontmatter.get(field_name)
            if val is None:
                continue
            if isinstance(val, str):
                val = [val]
            if isinstance(val, list):
                # [[링크]] 패턴에서 노트명 추출
                cleaned = []
                for v in val:
                    v_str = str(v)
                    match = WIKI_LINK_RE.search(v_str)
                    if match:
                        cleaned.append(match.group(1).strip())
                    else:
                        cleaned.append(v_str.strip())
                if cleaned:
                    relations[field_name] = cleaned
        return relations


def compute_checksum(content: str) -> str:
    """파일 내용 SHA-256 해시"""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """YAML frontmatter 파싱. (metadata, body) 반환"""
    match = FRONTMATTER_RE.match(text)
    if not match:
        match = FRONTMATTER_LOOSE_RE.match(text)
    if not match:
        return {}, text

    yaml_str = match.group(1)
    body = text[match.end():]

    try:
        metadata = yaml.safe_load(yaml_str)
        if not isinstance(metadata, dict):
            metadata = {}
    except yaml.YAMLError:
        metadata = {}

    return metadata, body


def extract_wiki_links(text: str) -> list[str]:
    """본문에서 [[위키링크]] 추출 (중복 제거, 순서 유지)"""
    seen = set()
    links = []
    for match in WIKI_LINK_RE.finditer(text):
        link = match.group(1).strip()
        if link and link not in seen:
            seen.add(link)
            links.append(link)
    return links


def extract_tags(frontmatter: dict, body: str) -> list[str]:
    """YAML tags + 본문 인라인 태그 통합 (중복 제거)"""
    tags = set()

    # YAML tags
    yaml_tags = frontmatter.get("tags") or []
    if isinstance(yaml_tags, str):
        yaml_tags = [t.strip().lstrip("#") for t in yaml_tags.split(",") if t.strip()]
    elif isinstance(yaml_tags, list):
        yaml_tags = [str(t).strip().lstrip("#") for t in yaml_tags if t is not None]
    else:
        yaml_tags = []
    tags.update(t for t in yaml_tags if t)

    # 인라인 #태그
    for match in INLINE_TAG_RE.finditer(body):
        tag = match.group(1).strip()
        if tag and len(tag) > 1:  # 한 글자 태그 제외
            tags.add(tag)

    return sorted(tags)


def extract_headings(body: str) -> list[str]:
    """마크다운 헤딩 추출"""
    headings = []
    for line in body.split("\n"):
        stripped = line.strip()
        if stripped.startswith("#") and " " in stripped:
            level = len(stripped) - len(stripped.lstrip("#"))
            if 1 <= level <= 4:
                heading_text = stripped.lstrip("#").strip()
                if heading_text:
                    headings.append(heading_text)
    return headings


def parse_note(file_path: Path, vault_root: Path | None = None) -> NoteDocument | None:
    """단일 마크다운 파일 파싱.

    Args:
        file_path: 파일 경로
        vault_root: 볼트 루트 경로 (key 생성용). None이면 파일명을 key로 사용.
    """
    try:
        content = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        try:
            content = file_path.read_text(encoding="cp949")
        except (UnicodeDecodeError, OSError):
            return None

    frontmatter, body = parse_frontmatter(content)
    wiki_links = extract_wiki_links(body)
    tags = extract_tags(frontmatter, body)
    headings = extract_headings(body)
    checksum = compute_checksum(content)

    # key = 볼트 루트 기준 상대경로 (확장자 제외, forward slash)
    if vault_root is not None:
        try:
            rel = file_path.resolve().relative_to(vault_root.resolve())
            key = rel.with_suffix("").as_posix()
        except ValueError:
            key = file_path.stem
    else:
        key = file_path.stem

    return NoteDocument(
        path=file_path,
        name=file_path.stem,
        key=key,
        content=content,
        body=body,
        frontmatter=frontmatter,
        wiki_links=wiki_links,
        tags=tags,
        headings=headings,
        checksum=checksum,
    )


def parse_vault(vault_path: str | Path, exclude_dirs: set[str] | None = None) -> list[NoteDocument]:
    """볼트 전체 파싱"""
    vault = Path(vault_path)
    if not vault.exists():
        raise FileNotFoundError(f"Vault not found: {vault}")

    if exclude_dirs is None:
        exclude_dirs = {".obsidian", ".trash", ".git", "node_modules", ".mnemo"}

    notes = []
    for md_file in sorted(vault.rglob("*.md")):
        # 제외 디렉토리 필터링
        if any(part in exclude_dirs for part in md_file.parts):
            continue

        note = parse_note(md_file, vault_root=vault)
        if note is not None:
            notes.append(note)

    return notes
