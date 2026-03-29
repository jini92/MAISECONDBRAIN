"""콘텐츠 기반 태그 + 백링크 자동 발견"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from .parser import NoteDocument


# 토픽 → 태그 매핑 (내용에서 키워드 발견 시 태그 추가)
TOPIC_TAGS = {
    # AI/ML
    "AI": ["LLM", "GPT", "Claude", "Anthropic", "OpenAI", "딥러닝", "머신러닝",
            "machine learning", "deep learning", "transformer", "fine-tuning", "파인튜닝"],
    "RAG": ["RAG", "GraphRAG", "벡터", "임베딩", "embedding", "retrieval", "검색증강"],
    "LLM": ["GPT-4", "GPT-3", "Claude", "Gemini", "LLaMA", "Qwen", "DeepSeek",
            "대규모 언어모델", "언어모델"],
    "자동화": ["자동화", "automation", "워크플로우", "workflow", "n8n", "파이프라인", "pipeline"],
    "보안": ["보안", "security", "취약점", "vulnerability", "CVE", "SBOM", "스캐너"],
    "TikTok": ["TikTok", "틱톡", "숏폼", "short-form", "릴스", "Reels"],
    "화장품": ["화장품", "cosmetic", "K-뷰티", "K-beauty", "스킨케어", "skincare", "뷰티"],
    "베트남": ["베트남", "Vietnam", "호치민", "HCMC", "하노이", "Hanoi"],
    "옵시디언": ["옵시디언", "Obsidian", "마크다운", "markdown", "노트", "PKM"],
    "GraphRAG": ["GraphRAG", "지식그래프", "knowledge graph", "온톨로지", "ontology",
                 "NetworkX", "그래프"],
    "DevOps": ["Docker", "CI/CD", "GitHub Actions", "Railway", "배포", "deploy"],
    "API": ["API", "REST", "FastAPI", "엔드포인트", "endpoint"],
    "프론트엔드": ["React", "Next.js", "TypeScript", "Tailwind", "프론트엔드", "frontend", "UI/UX"],
    "데이터": ["데이터", "database", "PostgreSQL", "SQLite", "데이터베이스", "SQL", "스키마"],
    "크롤링": ["크롤링", "crawling", "스크래핑", "scraping", "Selenium", "Playwright"],
    "모바일": ["React Native", "Flutter", "iOS", "Android", "모바일", "앱"],
    "클라우드": ["AWS", "GCP", "Azure", "Cloudflare", "클라우드", "cloud", "서버리스"],
    "블록체인": ["블록체인", "blockchain", "가상화폐", "crypto", "비트코인", "이더리움"],
    "교육": ["교육", "education", "튜터", "tutor", "학습", "learning", "코스"],
    "수익화": ["수익화", "monetization", "BM", "비즈니스모델", "revenue", "매출", "구독"],
}

# 프로젝트 키워드 (내용에서 발견 시 project 태그)
PROJECT_KEYWORDS = {
    "MAIOSS": ["MAIOSS", "오픈소스 보안", "OSS 보안", "보안 스캐너", "취약점 검증"],
    "MAIBEAUTY": ["MAIBEAUTY", "뷰티앤팩토리", "BeautyNFactory", "화장품 사업", "BnF"],
    "MAIAX": ["MAIAX", "C&E", "삼성엔지니어링", "삼성 엔지니어링", "자동화 시스템", "7KL"],
    "MAITOK": ["MAITOK", "Tikly", "TikTok 댓글", "틱톡 댓글"],
    "MAIBOTALKS": ["MAIBOTALKS", "BOTALKS", "음성대화", "음성 AI"],
    "MAICON": ["MAICON", "BOTCON", "예약 서비스", "로컬 서비스"],
    "MAITUTOR": ["MAITUTOR", "BOTTUTOR", "AI 튜터", "학습 도우미"],
    "MAISTAR7": ["MAISTAR7", "인력 매칭", "한국기업 베트남"],
    "MAISECONDBRAIN": ["MAISECONDBRAIN", "Mnemo", "세컨드브레인", "지식그래프"],
    "MAIPnID": ["MAIPnID", "P&ID", "배관", "계장"],
}


def extract_content_tags(note: "NoteDocument") -> list[str]:
    """노트 내용에서 관련 태그 추출"""
    content = (note.body + " " + note.name).lower()
    existing = {str(t).lower() for t in note.tags}
    new_tags = []

    for tag, keywords in TOPIC_TAGS.items():
        if tag.lower() in existing:
            continue
        for kw in keywords:
            if kw.lower() in content:
                new_tags.append(tag)
                break

    return new_tags


def extract_project_from_content(note: "NoteDocument") -> str | None:
    """내용에서 프로젝트 추론"""
    if note.frontmatter.get("project"):
        return None

    content = note.body + " " + note.name
    for project, keywords in PROJECT_KEYWORDS.items():
        for kw in keywords:
            if kw in content:
                return project

    return None


def find_missing_backlinks(
    note: "NoteDocument",
    all_note_names: set[str],
    name_index: dict[str, str],
) -> list[str]:
    """내용에서 다른 노트를 언급하지만 [[링크]] 안 된 것 발견"""
    content = note.body
    existing_links = set(note.wiki_links)
    missing = []

    # 긴 이름부터 매칭 (부분 매칭 방지)
    for name in sorted(all_note_names, key=len, reverse=True):
        if name == note.name:
            continue
        if name in existing_links:
            continue
        if len(name) < 5:  # 너무 짧은 이름은 스킵
            continue

        # 내용에서 정확한 이름 매칭
        if name in content:
            missing.append(name)
            if len(missing) >= 10:
                break

    return missing


@dataclass
class ContentEnrichment:
    path: Path
    name: str
    new_tags: list[str] = field(default_factory=list)
    new_project: str | None = None
    new_backlinks: list[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        return bool(self.new_tags or self.new_project or self.new_backlinks)


def analyze_all(notes: list["NoteDocument"]) -> list[ContentEnrichment]:
    """전체 노트 분석"""
    all_names = {n.name for n in notes}
    # 소문자 → 원래이름 인덱스
    name_index = {n.name.lower(): n.name for n in notes}

    results = []
    for note in notes:
        enrichment = ContentEnrichment(path=note.path, name=note.name)

        # 태그 추출
        enrichment.new_tags = extract_content_tags(note)

        # 프로젝트 추론
        enrichment.new_project = extract_project_from_content(note)

        # 백링크 발견
        enrichment.new_backlinks = find_missing_backlinks(note, all_names, name_index)

        if enrichment.has_changes:
            results.append(enrichment)

    return results


def apply_content_enrichment(
    enrichment: ContentEnrichment,
    dry_run: bool = True,
) -> str | None:
    """보강 적용"""
    path = Path(enrichment.path)
    if not path.exists():
        return None

    content = path.read_text(encoding="utf-8")

    # Frontmatter 분리
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            fm_text = content[3:end].strip()
            body = content[end + 3:]
        else:
            fm_text = ""
            body = content
    else:
        fm_text = ""
        body = content

    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        fm = {}

    changed = False
    changes = []

    # 태그 추가
    if enrichment.new_tags:
        existing_tags = fm.get("tags", [])
        if existing_tags is None:
            existing_tags = []
        if isinstance(existing_tags, str):
            existing_tags = [existing_tags]
        existing_lower = {str(t).lower() for t in existing_tags}
        added_tags = [t for t in enrichment.new_tags if t.lower() not in existing_lower]
        if added_tags:
            fm["tags"] = existing_tags + added_tags
            changed = True
            changes.append(f"+tags: {', '.join(added_tags)}")

    # 프로젝트 추가
    if enrichment.new_project and "project" not in fm:
        fm["project"] = enrichment.new_project
        changed = True
        changes.append(f"project: {enrichment.new_project}")

    # 백링크 추가 (본문 끝에 Related Links 섹션)
    if enrichment.new_backlinks:
        links_section = "\n\n## Related Notes\n"
        for link in enrichment.new_backlinks:
            links_section += f"- [[{link}]]\n"

        # 이미 Related Notes 섹션이 있으면 스킵
        if "## Related Notes" not in body:
            body = body.rstrip() + links_section
            changed = True
            changes.append(f"+backlinks: {len(enrichment.new_backlinks)}")

    if not changed:
        return None

    change_str = ", ".join(changes)

    if dry_run:
        return f"[DRY] {enrichment.name}: {change_str}"

    new_fm = yaml.dump(fm, allow_unicode=True, default_flow_style=False, sort_keys=False).strip()
    new_content = f"---\n{new_fm}\n---{body}"
    path.write_text(new_content, encoding="utf-8")
    return f"[OK] {enrichment.name}: {change_str}"
