"""온톨로지 엔진 — 노트를 엔티티로 분류하고 관계를 추출

엔티티 타입 체계 (v2, 2026-02-24):
  - person: 사람 (팀원, 고객, 파트너, 멘토)
  - concept: 개념/이론/전략/패턴
  - project: MAI 프로젝트 + 외부 프로젝트
  - tool: 기술 도구/프레임워크/서비스
  - insight: 인사이트/교훈/회고
  - source: 외부 소스 (책, 영상, 논문, 블로그)
  - event: 이벤트 (데일리, 미팅, 브리핑)
  - decision: 의사결정/정책/아키텍처 선택
"""

from __future__ import annotations

import re

from .parser import NoteDocument

# ── 태그 → 엔티티 타입 매핑 (v2: 키워드 대폭 확장) ──
TAG_ENTITY_MAP: dict[str, list[str]] = {
    "person": [
        "person", "people", "team", "author", "mentor",
        "인물", "담당자", "고객", "파트너", "대표", "매니저",
        "developer", "engineer", "founder", "ceo", "cto",
    ],
    "concept": [
        "concept", "idea", "theory", "principle", "pattern",
        "전략", "방법론", "아키텍처", "디자인패턴", "워크플로우",
        "methodology", "strategy", "workflow", "paradigm",
        "온톨로지", "프레임워크설계", "모델", "알고리즘",
    ],
    "project": [
        "project", "mai", "maibot", "maioss", "maibeauty", "maiax",
        "maitok", "maitutor", "maibotalks", "maicon", "maistar7",
        "maisecondbrain", "maipatent", "maitalkcart", "maithink",
        "maitcad", "maitb", "maipnid", "maiupbit",
    ],
    "tool": [
        "tool", "software", "framework", "library", "plugin", "language",
        "python", "typescript", "javascript", "react", "next", "node",
        "docker", "ollama", "railway", "vercel", "expo", "supabase",
        "postgres", "postgresql", "mongodb", "redis", "influxdb",
        "obsidian", "mcp", "api", "sdk", "cli", "git", "github",
        "vscode", "cursor", "claude", "openai", "gemini",
        "n8n", "playwright", "vitest", "pnpm", "bun", "npm",
        "cloudflare", "aws", "gcp", "azure", "terraform",
        "fastapi", "flask", "django", "express", "nextjs",
    ],
    "insight": [
        "insight", "lesson", "takeaway", "learning",
        "til", "회고", "retrospective", "발견", "교훈",
        "lessons-learned", "lessons_learned", "배운점",
    ],
    "source": [
        "book", "video", "article", "paper", "podcast", "youtube", "blog",
        "외부지식", "참고자료", "레퍼런스", "reference",
    ],
    "event": [
        "meeting", "event", "conference", "review", "daily",
        "미팅", "회의", "브리핑", "스프린트", "데모",
    ],
    "decision": [
        "decision", "policy", "architecture",
        "결정", "선택", "마이그레이션", "전환", "채택", "폐기",
        "adr", "rfc",
    ],
}

# ── 폴더 → 엔티티 타입 힌트 ──
FOLDER_ENTITY_MAP: dict[str, str] = {
    "00.DAILY": "event",
    "01.PROJECT": "project",
    "02.AREA": "concept",
    "03.RESOURCES": "source",
    "04.ARCHIVE": "note",
    "05.DEBUGGING": "event",
    "tasks": "note",
    "docs": "note",
    "skills": "tool",
    "chatGPT": "source",
    "AI": "concept",
    "외부지식": "source",
    "스텁": "note",
}

# ── 파일명 패턴 → 엔티티 타입 (event 세분화 포함) ──
# 순서 중요: 먼저 매칭되는 것이 우선
NAME_TYPE_RULES: list[tuple[str, str]] = [
    # event 세분화
    (r"Lessons?_?Learned|TIL|회고", "insight"),
    (r"미팅|회의|meeting|Meeting", "event"),     # meeting (event 유지)
    (r"브리핑|Briefing|리포트|Report|Scan", "event"),  # report (event 유지)
    (r"개발현황|Debugging|디버깅|devlog", "event"),     # devlog (event 유지)
    # 문서 타입
    (r"^A\d{3}-", "source"),        # A001- → 분석 문서
    (r"^D\d{3}-", "concept"),       # D001- → 설계 문서
    (r"^I\d{3}-", "note"),          # I001- → 구현 문서
    (r"^T\d{3}-", "note"),          # T001- → 테스트 문서
    # 도구/설정
    (r"설정|설치|Setup|Install|Config|config", "tool"),
    (r"_?api_?key|_?token|_?credential", "tool"),
    # 전략/개념
    (r"전략|Strategy|Methodology|워크플로우|Architecture", "concept"),
    (r"사업계획|비즈니스|Business|PRD", "concept"),
]


def classify_entity(note: NoteDocument) -> str:
    """노트의 엔티티 타입을 결정.

    우선순위:
    1. YAML type: 필드 (명시적)
    2. 파일명 패턴 매칭
    3. 태그 기반 추론
    4. 폴더 기반 힌트
    5. 기본값 'note'
    """
    # 1. YAML type 직접 사용
    yaml_type = note.frontmatter.get("type", "").strip().lower()
    if yaml_type and yaml_type in TAG_ENTITY_MAP:
        return yaml_type

    # 2. 파일명 패턴 매칭 (event 세분화 등)
    for pattern, entity_type in NAME_TYPE_RULES:
        if re.search(pattern, note.name, re.IGNORECASE):
            return entity_type

    # 3. 태그 기반 추론
    note_tags_lower = {t.lower() for t in note.tags}
    scores: dict[str, int] = {}
    for entity_type, keywords in TAG_ENTITY_MAP.items():
        score = len(note_tags_lower & set(keywords))
        if score > 0:
            scores[entity_type] = score

    if scores:
        return max(scores, key=scores.get)  # type: ignore[arg-type]

    # 4. 폴더 기반 힌트
    for part in note.path.parts:
        if part in FOLDER_ENTITY_MAP:
            return FOLDER_ENTITY_MAP[part]

    # 5. 기본값
    return "note"


def enrich_note(note: NoteDocument) -> NoteDocument:
    """노트에 온톨로지 정보 추가 (frontmatter에 inferred_type 설정)"""
    if "type" not in note.frontmatter:
        inferred = classify_entity(note)
        note.frontmatter["_inferred_type"] = inferred
    return note
