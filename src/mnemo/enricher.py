"""볼트 노트 자동 보강 — frontmatter 추가/정규화"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from .parser import NoteDocument


@dataclass
class EnrichmentPlan:
    """한 노트의 보강 계획"""
    path: Path
    add_type: str | None = None
    add_tags: list[str] = field(default_factory=list)
    add_related: list[str] = field(default_factory=list)
    add_project: str | None = None
    changes: list[str] = field(default_factory=list)


# 프로젝트 매핑
PROJECT_MAP = {
    "MAIOSS": "MAIOSS",
    "MAIBEAUTY": "MAIBEAUTY",
    "MAIAX": "MAIAX",
    "MAIBOT": "MAIBOT",
    "MAISTAR7": "MAISTAR7",
    "MAICON": "MAICON",
    "MAITUTOR": "MAITUTOR",
    "MAIBOTALKS": "MAIBOTALKS",
    "MAITOK": "MAITOK",
    "MAISECONDBRAIN": "MAISECONDBRAIN",
    "MAIPnID": "MAIPnID",
    "MAIPatent": "MAIPatent",
    "MAITalkCart": "MAITalkCart",
    "MAITHINK": "MAITHINK",
    "MAITCAD": "MAITCAD",
    "MAITB": "MAITB",
    "MAIUPbit": "MAIUPbit",
    "C&E": "MAIAX",
    "삼성엔지니어링": "MAIAX",
}

# 타입 추론 규칙 (v2 — 온톨로지 엔티티 타입에 매핑)
TYPE_RULES = [
    # (패턴, 타입)
    (r"^\d{4}-\d{2}-\d{2}", "event"),             # 날짜로 시작 → 이벤트
    (r"^A\d{3}-", "source"),                       # A001- → 분석 문서 (source)
    (r"^D\d{3}-", "concept"),                      # D001- → 설계 문서 (concept)
    (r"^I\d{3}-", "note"),                         # I001- → 구현 문서
    (r"^T\d{3}-", "note"),                         # T001- → 테스트 문서
    (r"Lessons?_?Learned|TIL|회고", "insight"),     # 교훈/회고
    (r"_개발현황", "event"),                        # 개발현황 → event
    (r"_디버깅|_Debugging", "event"),
    (r"미팅|회의|meeting", "event"),
    (r"분석|Analysis|Research", "source"),
    (r"설계|Design|Architecture", "concept"),
    (r"브리핑|리포트|Report", "event"),
    (r"가이드|Guide|Tutorial", "source"),
    (r"설정|설치|Setup|Install|Config", "tool"),    # 도구 설정
    (r"_?api_?key|_?token|credential", "tool"),    # 인증 키 관련
    (r"전략|Strategy|Methodology", "concept"),      # 전략 문서
    (r"사업계획|Business|PRD", "concept"),           # 사업 계획
    (r"결정|선택|마이그레이션|전환|ADR", "decision"), # 의사결정
]

# 태그 정규화
TAG_NORMALIZE = {
    "삼성엔지니어링": "삼성엔지니어링",
    "삼성EnA": "삼성엔지니어링",
    "C&E": "C&E-자동화",
    "오픈소스보안": "보안",
    "신뢰도": "보안",
}


def infer_type(note: "NoteDocument") -> str | None:
    """노트 이름 + 경로에서 타입 추론"""
    name = note.name
    for pattern, note_type in TYPE_RULES:
        if re.search(pattern, name, re.IGNORECASE):
            return note_type

    # 폴더 기반
    path_str = str(note.path)
    if "00.DAILY" in path_str:
        return "event"
    if "TEMPLATES" in path_str:
        return "template"
    if "tasks" in path_str:
        return "task"
    if "docs" in path_str:
        return "document"

    return None


def infer_project(note: "NoteDocument") -> str | None:
    """경로 + 태그 + 내용에서 프로젝트 추론"""
    path_str = str(note.path)
    name = note.name

    # 경로에서 직접 매핑
    for key, proj in PROJECT_MAP.items():
        if key in path_str or key in name:
            return proj

    # 태그에서
    for tag in note.tags:
        tag_lower = str(tag).lower()
        for key, proj in PROJECT_MAP.items():
            if key.lower() in tag_lower:
                return proj

    return None


def infer_related(note: "NoteDocument", all_notes: list["NoteDocument"]) -> list[str]:
    """관련 노트 추론 — 같은 프로젝트 + 날짜 근접 + 태그 겹침"""
    related = []
    note_tags = set(note.tags)
    note_project = infer_project(note)

    # 날짜 추출 (YYYY-MM-DD)
    date_match = re.match(r"(\d{4}-\d{2}-\d{2})", note.name)
    note_date = date_match.group(1) if date_match else None

    for other in all_notes:
        if other.name == note.name:
            continue

        score = 0

        # 같은 프로젝트
        if note_project and infer_project(other) == note_project:
            score += 1

        # 태그 겹침
        overlap = note_tags & set(other.tags)
        if len(overlap) >= 2:
            score += len(overlap)

        # 같은 날짜
        if note_date:
            other_date_match = re.match(r"(\d{4}-\d{2}-\d{2})", other.name)
            if other_date_match and other_date_match.group(1) == note_date:
                score += 2

        if score >= 3:
            related.append(f"[[{other.name}]]")

    # 상위 5개
    return related[:5]


def plan_enrichment(
    notes: list["NoteDocument"],
    auto_related: bool = False,
) -> list[EnrichmentPlan]:
    """전체 노트의 보강 계획 생성"""
    plans = []

    for note in notes:
        plan = EnrichmentPlan(path=note.path)
        fm = note.frontmatter

        # type 추가
        if not fm.get("type"):
            inferred = infer_type(note)
            if inferred:
                plan.add_type = inferred
                plan.changes.append(f"type: {inferred}")

        # project 추가
        if not fm.get("project"):
            proj = infer_project(note)
            if proj:
                plan.add_project = proj
                plan.changes.append(f"project: {proj}")

        # related 추론 (비용 높으므로 옵션)
        if auto_related and not fm.get("related"):
            related = infer_related(note, notes)
            if related:
                plan.add_related = related
                plan.changes.append(f"related: {len(related)} notes")

        if plan.changes:
            plans.append(plan)

    return plans


def apply_enrichment(plan: EnrichmentPlan, dry_run: bool = True) -> str | None:
    """보강 계획을 실제 파일에 적용"""
    path = Path(plan.path)
    if not path.exists():
        return None

    content = path.read_text(encoding="utf-8")

    # Frontmatter 파싱
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

    # YAML 파싱
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        fm = {}

    # 필드 추가 (키가 없거나 falsy일 때 보강)
    changed = False
    if plan.add_type and not fm.get("type"):
        fm["type"] = plan.add_type
        changed = True
    if plan.add_project and not fm.get("project"):
        fm["project"] = plan.add_project
        changed = True
    if plan.add_related and not fm.get("related"):
        fm["related"] = plan.add_related
        changed = True

    if not changed:
        return None

    # YAML 직렬화 (한글 지원)
    new_fm = yaml.dump(fm, allow_unicode=True, default_flow_style=False, sort_keys=False).strip()
    new_content = f"---\n{new_fm}\n---{body}"

    if dry_run:
        return f"[DRY RUN] {path.name}: {', '.join(plan.changes)}"

    path.write_text(new_content, encoding="utf-8")
    return f"[APPLIED] {path.name}: {', '.join(plan.changes)}"
