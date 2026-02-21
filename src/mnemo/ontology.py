"""온톨로지 엔진 — 노트를 엔티티로 분류하고 관계를 추출"""

from __future__ import annotations

from .parser import NoteDocument

# 태그 → 엔티티 타입 매핑
TAG_ENTITY_MAP: dict[str, list[str]] = {
    "person": ["person", "people", "team", "author", "mentor"],
    "concept": ["concept", "idea", "theory", "principle", "pattern"],
    "project": ["project", "mai", "maibot", "maioss", "maibeauty", "maiax",
                 "maitok", "maitutor", "maibotalks", "maicon", "maistar7", "maisecondbrain"],
    "tool": ["tool", "software", "framework", "library", "plugin", "language"],
    "insight": ["insight", "lesson", "takeaway", "learning"],
    "source": ["book", "video", "article", "paper", "podcast", "youtube", "blog"],
    "event": ["meeting", "event", "conference", "review", "daily"],
    "decision": ["decision", "policy", "architecture"],
}

# 폴더 → 엔티티 타입 힌트
FOLDER_ENTITY_MAP: dict[str, str] = {
    "00.DAILY": "event",
    "01.PROJECT": "project",
    "02.AREA": "concept",
    "03.RESOURCES": "source",
    "04.ARCHIVE": "note",
    "tasks": "note",
    "docs": "note",
}


def classify_entity(note: NoteDocument) -> str:
    """노트의 엔티티 타입을 결정.

    우선순위:
    1. YAML type: 필드 (명시적)
    2. 태그 기반 추론
    3. 폴더 기반 힌트
    4. 기본값 'note'
    """
    # 1. YAML type 직접 사용
    yaml_type = note.frontmatter.get("type", "").strip().lower()
    if yaml_type and yaml_type in TAG_ENTITY_MAP:
        return yaml_type

    # 2. 태그 기반 추론
    note_tags_lower = {t.lower() for t in note.tags}
    scores: dict[str, int] = {}
    for entity_type, keywords in TAG_ENTITY_MAP.items():
        score = len(note_tags_lower & set(keywords))
        if score > 0:
            scores[entity_type] = score

    if scores:
        return max(scores, key=scores.get)  # type: ignore[arg-type]

    # 3. 폴더 기반 힌트
    for part in note.path.parts:
        if part in FOLDER_ENTITY_MAP:
            return FOLDER_ENTITY_MAP[part]

    # 4. 기본값
    return "note"


def enrich_note(note: NoteDocument) -> NoteDocument:
    """노트에 온톨로지 정보 추가 (frontmatter에 inferred_type 설정)"""
    if "type" not in note.frontmatter:
        inferred = classify_entity(note)
        note.frontmatter["_inferred_type"] = inferred
    return note
