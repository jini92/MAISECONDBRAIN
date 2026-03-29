from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date, datetime
import re
from typing import Any

import networkx as nx

from .parser import NoteDocument

CORE_ENTITY_TYPES = {
    "person",
    "concept",
    "project",
    "tool",
    "insight",
    "source",
    "event",
    "decision",
    "note",
}

GRAPH_ENTITY_TYPES = CORE_ENTITY_TYPES | {"unknown", "attachment", "dangling_ref"}

TYPE_ALIASES: dict[str, str] = {
    "daily note": "event",
    "daily-note": "event",
    "daily": "event",
    "meeting": "event",
    "briefing": "event",
    "daily-briefing": "event",
    "session-log": "event",
    "update-check": "event",
    "task": "note",
    "stub": "note",
    "document": "note",
    "implementation": "note",
    "template": "note",
    "test": "note",
    "analysis": "source",
    "report": "source",
    "reference": "source",
    "reference note": "source",
    "guide": "source",
    "design": "concept",
    "project-memory": "project",
}

DATE_FIELDS = {"created", "updated", "event_date", "decided", "consumed", "first_met"}
URL_FIELDS = {"url", "github"}

ENUM_FIELDS: dict[str, set[str]] = {
    "importance": {"high", "medium", "low"},
    "status": {"active", "paused", "completed", "archived"},
    "confidence": {"high", "medium", "low"},
    "source_type": {"book", "video", "article", "paper", "podcast", "blog", "course", "newsletter", "note"},
    "category": {"language", "framework", "service", "library", "plugin", "model", "database", "platform", "tool"},
}

RELATION_OWNER_TYPES: dict[str, set[str]] = {
    "uses": {"project", "tool", "concept"},
    "used_in": {"tool"},
    "source": {"concept", "insight", "source", "note"},
    "derived_from": {"concept", "insight", "project", "decision"},
    "supports": {"concept", "insight", "decision"},
    "contradicts": {"concept", "insight", "decision"},
    "applied_to": {"insight", "concept"},
    "alternatives": {"tool", "project", "concept", "decision"},
    "participants": {"event"},
    "decisions": {"event"},
    "organization": {"person"},
}

RELATION_TARGET_TYPES: dict[str, set[str]] = {
    "uses": {"tool", "concept", "project", "note"},
    "used_in": {"project"},
    "source": {"source", "note", "concept", "insight"},
    "derived_from": {"source", "concept", "insight", "decision", "note"},
    "supports": {"concept", "decision", "insight", "project"},
    "contradicts": {"concept", "decision", "insight"},
    "applied_to": {"project", "concept"},
    "alternatives": {"tool", "project", "concept", "decision", "note"},
    "participants": {"person", "project", "tool", "note"},
    "decisions": {"decision"},
    "organization": {"project", "person", "note"},
}

TYPE_REQUIREMENTS: dict[str, dict[str, list[str]]] = {
    "person": {"any_of": ["role", "organization"]},
    "concept": {"any_of": ["source", "related", "supports", "contradicts", "derived_from"]},
    "project": {"any_of": ["local_path", "github", "uses", "related"]},
    "tool": {"required": ["category"], "any_of": ["url", "used_in", "alternatives"]},
    "insight": {"required": ["source"], "any_of": ["applied_to", "related"]},
    "source": {"required": ["source_type"], "any_of": ["url", "author", "key_takeaways"]},
    "event": {"required": ["event_date"], "any_of": ["participants", "decisions", "related"]},
    "decision": {"required": ["decided", "chosen", "rationale"], "any_of": ["context", "alternatives", "related"]},
}

WIKI_LINK_RE = re.compile(r"^\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|[^\]]+?)?\]\]$")
URL_RE = re.compile(r"^https?://", re.IGNORECASE)
LOCAL_PATH_RE = re.compile(r"^(?:[A-Za-z]:\\|/|~)\S+")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class ShapeViolation:
    node: str
    entity_type: str
    severity: str
    rule: str
    message: str
    field: str | None = None
    actual: str | None = None


def _normalize_type_name(value: Any) -> tuple[str | None, bool]:
    if value is None:
        return None, False
    normalized = str(value).strip().lower()
    if not normalized:
        return None, False
    if normalized in CORE_ENTITY_TYPES:
        return normalized, True
    alias = TYPE_ALIASES.get(normalized)
    if alias:
        return alias, False
    return normalized, False


def _value_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return True


def _format_actual(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _is_valid_iso_date(value: Any) -> bool:
    if isinstance(value, datetime):
        return True
    if isinstance(value, date):
        return True
    if isinstance(value, str):
        return bool(ISO_DATE_RE.match(value.strip()))
    return False


def _is_valid_url(value: Any) -> bool:
    return isinstance(value, str) and bool(URL_RE.match(value.strip()))


def _is_valid_local_path(value: Any) -> bool:
    return isinstance(value, str) and bool(LOCAL_PATH_RE.match(value.strip()))


def _normalize_target_name(value: Any) -> str:
    text = str(value).strip()
    match = WIKI_LINK_RE.match(text)
    if match:
        return match.group(1).strip()
    return text


def _collect_target_types(G: nx.DiGraph, note_index: dict[str, NoteDocument]) -> dict[str, str]:
    target_types: dict[str, str] = {}
    for key in G.nodes:
        entity_type = str(G.nodes[key].get("entity_type", "unknown") or "unknown")
        target_types[key] = entity_type
    for note in note_index.values():
        target_types.setdefault(note.name, str(G.nodes.get(note.key, {}).get("entity_type", "note")))
        target_types.setdefault(note.key, str(G.nodes.get(note.key, {}).get("entity_type", "note")))
    return target_types


def _validate_common_fields(note: NoteDocument, entity_type: str) -> list[ShapeViolation]:
    violations: list[ShapeViolation] = []
    raw_type = note.frontmatter.get("type")

    if not _value_present(raw_type):
        violations.append(
            ShapeViolation(
                node=note.key,
                entity_type=entity_type,
                severity="warning",
                rule="missing-explicit-type",
                field="type",
                message="Explicit frontmatter type is missing; the ontology currently depends on inferred typing.",
            )
        )
    else:
        normalized_type, is_canonical = _normalize_type_name(raw_type)
        if normalized_type is None:
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="warning",
                    rule="invalid-type",
                    field="type",
                    actual=_format_actual(raw_type),
                    message="Frontmatter type is empty or malformed.",
                )
            )
        elif normalized_type not in CORE_ENTITY_TYPES:
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="warning",
                    rule="invalid-type",
                    field="type",
                    actual=_format_actual(raw_type),
                    message=f"Frontmatter type '{raw_type}' is not a supported ontology entity type.",
                )
            )
        elif not is_canonical:
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="warning",
                    rule="type-alias-used",
                    field="type",
                    actual=_format_actual(raw_type),
                    message=f"Frontmatter type '{raw_type}' is accepted via alias; canonical type is '{normalized_type}'.",
                )
            )

    for field_name, allowed_values in ENUM_FIELDS.items():
        value = note.frontmatter.get(field_name)
        if not _value_present(value):
            continue
        normalized = str(value).strip().lower()
        if normalized not in allowed_values:
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="warning",
                    rule="invalid-enum-value",
                    field=field_name,
                    actual=_format_actual(value),
                    message=f"Field '{field_name}' must be one of: {', '.join(sorted(allowed_values))}.",
                )
            )

    for field_name in DATE_FIELDS:
        value = note.frontmatter.get(field_name)
        if not _value_present(value):
            continue
        if not _is_valid_iso_date(value):
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="error",
                    rule="invalid-date-format",
                    field=field_name,
                    actual=_format_actual(value),
                    message=f"Field '{field_name}' must use ISO date format (YYYY-MM-DD).",
                )
            )

    for field_name in URL_FIELDS:
        value = note.frontmatter.get(field_name)
        if not _value_present(value):
            continue
        if field_name == "github" and not _is_valid_url(value):
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="error",
                    rule="invalid-url",
                    field=field_name,
                    actual=_format_actual(value),
                    message=f"Field '{field_name}' must be a valid http(s) URL.",
                )
            )
        if field_name == "url" and not _is_valid_url(value):
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="error",
                    rule="invalid-url",
                    field=field_name,
                    actual=_format_actual(value),
                    message=f"Field '{field_name}' must be a valid http(s) URL.",
                )
            )

    local_path = note.frontmatter.get("local_path")
    if _value_present(local_path) and not _is_valid_local_path(local_path):
        violations.append(
            ShapeViolation(
                node=note.key,
                entity_type=entity_type,
                severity="warning",
                rule="invalid-local-path",
                field="local_path",
                actual=_format_actual(local_path),
                message="Field 'local_path' should look like an absolute path.",
            )
        )

    return violations


def _validate_entity_requirements(note: NoteDocument, entity_type: str) -> list[ShapeViolation]:
    violations: list[ShapeViolation] = []
    requirements = TYPE_REQUIREMENTS.get(entity_type)
    if not requirements:
        return violations

    for field_name in requirements.get("required", []):
        if not _value_present(note.frontmatter.get(field_name)):
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="warning",
                    rule="missing-required-field",
                    field=field_name,
                    message=f"'{entity_type}' notes should define '{field_name}'.",
                )
            )

    any_of_fields = requirements.get("any_of", [])
    if any_of_fields and not any(_value_present(note.frontmatter.get(field_name)) for field_name in any_of_fields):
        violations.append(
            ShapeViolation(
                node=note.key,
                entity_type=entity_type,
                severity="warning",
                rule="missing-supporting-context",
                field=", ".join(any_of_fields),
                message=f"'{entity_type}' notes should provide at least one of: {', '.join(any_of_fields)}.",
            )
        )

    return violations


def _validate_relations(note: NoteDocument, entity_type: str, target_types: dict[str, str]) -> list[ShapeViolation]:
    violations: list[ShapeViolation] = []

    for relation_name, targets in note.yaml_relations.items():
        owner_types = RELATION_OWNER_TYPES.get(relation_name)
        if owner_types and entity_type not in owner_types:
            violations.append(
                ShapeViolation(
                    node=note.key,
                    entity_type=entity_type,
                    severity="warning",
                    rule="relation-owner-mismatch",
                    field=relation_name,
                    actual=entity_type,
                    message=f"Relation '{relation_name}' is unusual on entity type '{entity_type}'.",
                )
            )

        allowed_targets = RELATION_TARGET_TYPES.get(relation_name)
        if not allowed_targets:
            continue

        for target in targets:
            target_name = _normalize_target_name(target)
            target_type = target_types.get(target_name)
            if not target_type:
                target_type = target_types.get(target, "unknown")
            if target_type == "unknown":
                violations.append(
                    ShapeViolation(
                        node=note.key,
                        entity_type=entity_type,
                        severity="warning",
                        rule="relation-target-unknown",
                        field=relation_name,
                        actual=target_name,
                        message=f"Relation '{relation_name}' points to '{target_name}', but the target type is unknown.",
                    )
                )
                continue
            if target_type not in allowed_targets:
                violations.append(
                    ShapeViolation(
                        node=note.key,
                        entity_type=entity_type,
                        severity="error",
                        rule="relation-target-mismatch",
                        field=relation_name,
                        actual=f"{target_name} ({target_type})",
                        message=f"Relation '{relation_name}' expects target types {sorted(allowed_targets)}, got '{target_type}'.",
                    )
                )

    return violations


def validate_ontology_shapes(notes: list[NoteDocument], G: nx.DiGraph) -> dict[str, Any]:
    """Validate Mnemo ontology data with lightweight SHACL-style constraints.

    The validator checks explicit types, enum/date/url fields, type-specific
    required fields, and relation target compatibility. Results are saved both
    into graph metadata and as a structured report for dashboards/tests.
    """
    note_index = {note.key: note for note in notes}
    target_types = _collect_target_types(G, note_index)
    all_violations: list[ShapeViolation] = []
    severity_counter: Counter[str] = Counter()
    entity_counter: Counter[str] = Counter()
    rule_counter: Counter[str] = Counter()
    pass_nodes = 0
    warning_nodes = 0
    error_nodes = 0

    for note in notes:
        node_data = G.nodes.get(note.key, {})
        entity_type = str(node_data.get("entity_type", "note") or "note")

        violations = []
        violations.extend(_validate_common_fields(note, entity_type))
        violations.extend(_validate_entity_requirements(note, entity_type))
        violations.extend(_validate_relations(note, entity_type, target_types))

        warning_count = sum(1 for item in violations if item.severity == "warning")
        error_count = sum(1 for item in violations if item.severity == "error")
        if error_count:
            status = "error"
            error_nodes += 1
        elif warning_count:
            status = "warning"
            warning_nodes += 1
        else:
            status = "pass"
            pass_nodes += 1

        node_data["shape_status"] = status
        node_data["shape_warning_count"] = warning_count
        node_data["shape_error_count"] = error_count
        node_data["shape_violations"] = [asdict(item) for item in violations[:10]]

        for item in violations:
            all_violations.append(item)
            severity_counter[item.severity] += 1
            entity_counter[item.entity_type] += 1
            rule_counter[item.rule] += 1

    checked_nodes = len(notes)
    node_penalty = (error_nodes * 0.7) + (warning_nodes * 0.3)
    quality_score = round(max(0.0, 100.0 * (1.0 - (node_penalty / max(checked_nodes, 1)))), 1)

    summary = {
        "checked_nodes": checked_nodes,
        "passed_nodes": pass_nodes,
        "warning_nodes": warning_nodes,
        "error_nodes": error_nodes,
        "warnings": severity_counter.get("warning", 0),
        "errors": severity_counter.get("error", 0),
        "quality_score": quality_score,
        "by_entity_type": dict(entity_counter.most_common()),
        "by_rule": dict(rule_counter.most_common()),
    }

    report = {
        "summary": summary,
        "violations": [asdict(item) for item in all_violations],
    }

    G.graph["ontology_quality"] = summary
    G.graph["ontology_quality_top_violations"] = report["violations"][:50]
    return report


# ── Advanced Graph-Level Validation ─────────────────────────────────────

# Relationship types that form dependency chains worth checking for cycles.
_DEPENDENCY_RELATIONS = {"derived_from", "supports", "uses"}

# Inverse relationship pairs: if A->B via key, B->A should have the value.
INVERSE_RELATIONS: dict[str, str] = {
    "uses": "used_in",
    "used_in": "uses",
    "supports": "supported_by",
    "supported_by": "supports",
    "derived_from": "derives",
    "derives": "derived_from",
}

# Cardinality constraints beyond TYPE_REQUIREMENTS.
# Format: {entity_type: {"min_of": (fields_tuple, min_count, severity)}}
CARDINALITY_CONSTRAINTS: dict[str, list[tuple[tuple[str, ...], int, str]]] = {
    "person": [
        (("role", "organization"), 1, "warning"),
    ],
    "decision": [
        (("chosen", "rationale", "alternatives"), 2, "warning"),
    ],
}


def check_circular_dependencies(G: nx.DiGraph) -> list[ShapeViolation]:
    """의존 관계(derived_from, supports, uses)에서 순환 참조를 탐지한다.

    각 관계 유형별로 서브그래프를 추출한 뒤 사이클을 찾아 warning을 반환한다.
    """
    violations: list[ShapeViolation] = []

    for rel_type in _DEPENDENCY_RELATIONS:
        sub = nx.DiGraph()
        for u, v, data in G.edges(data=True):
            if data.get("relation") == rel_type:
                sub.add_edge(u, v)

        for cycle in nx.simple_cycles(sub):
            cycle_path = " → ".join(cycle + [cycle[0]])
            for node in cycle:
                entity_type = str(G.nodes.get(node, {}).get("entity_type", "unknown"))
                violations.append(
                    ShapeViolation(
                        node=node,
                        entity_type=entity_type,
                        severity="warning",
                        rule="circular-dependency",
                        field=rel_type,
                        actual=cycle_path,
                        message=f"순환 참조 발견 ({rel_type}): {cycle_path}",
                    )
                )

    return violations


def check_cardinality_constraints(G: nx.DiGraph) -> list[ShapeViolation]:
    """엔티티별 카디널리티 제약 조건을 검증한다.

    TYPE_REQUIREMENTS의 required/any_of와 별도로, 최소 N개 이상 필드가
    존재해야 하는 고급 제약 조건을 검사한다.
    """
    violations: list[ShapeViolation] = []

    for node_key in G.nodes:
        node_data = G.nodes[node_key]
        entity_type = str(node_data.get("entity_type", "unknown"))

        constraints = CARDINALITY_CONSTRAINTS.get(entity_type)
        if not constraints:
            continue

        for fields, min_count, severity in constraints:
            present = sum(1 for f in fields if _value_present(node_data.get(f)))
            if present < min_count:
                fields_str = ", ".join(fields)
                violations.append(
                    ShapeViolation(
                        node=node_key,
                        entity_type=entity_type,
                        severity=severity,
                        rule="cardinality-violation",
                        field=fields_str,
                        actual=f"{present}/{min_count}",
                        message=(
                            f"'{entity_type}' 노드는 [{fields_str}] 중 "
                            f"최소 {min_count}개가 필요하지만 {present}개만 존재합니다."
                        ),
                    )
                )

    return violations


def check_dangling_references(G: nx.DiGraph) -> list[ShapeViolation]:
    """댕글링 참조(dangling=True 또는 entity_type='unknown') 노드를 탐지한다.

    해당 노드를 참조하는 상위 노드 목록과 함께 경고를 반환한다.
    """
    violations: list[ShapeViolation] = []

    for node_key in G.nodes:
        node_data = G.nodes[node_key]
        is_dangling = node_data.get("dangling") is True
        is_unknown = str(node_data.get("entity_type", "")) in ("unknown", "dangling_ref")

        if not (is_dangling or is_unknown):
            continue

        referring_nodes = [u for u, _ in G.in_edges(node_key)]
        referrers_str = ", ".join(referring_nodes[:5]) if referring_nodes else "(없음)"
        if len(referring_nodes) > 5:
            referrers_str += f" 외 {len(referring_nodes) - 5}개"

        entity_type = str(node_data.get("entity_type", "unknown"))
        violations.append(
            ShapeViolation(
                node=node_key,
                entity_type=entity_type,
                severity="warning",
                rule="dangling-reference",
                field=None,
                actual=referrers_str,
                message=(
                    f"댕글링 참조 노드입니다. "
                    f"참조하는 노드: {referrers_str}"
                ),
            )
        )

    return violations


def check_semantic_consistency(G: nx.DiGraph) -> list[ShapeViolation]:
    """동일 타겟에 supports와 contradicts가 동시에 존재하는 모순을 탐지한다.

    하나의 노드가 같은 대상을 지지하면서 동시에 반박하는 경우 error를 반환한다.
    """
    violations: list[ShapeViolation] = []

    # 각 노드별로 supports/contradicts 타겟을 수집
    supports_map: dict[str, set[str]] = {}
    contradicts_map: dict[str, set[str]] = {}

    for u, v, data in G.edges(data=True):
        rel = data.get("relation")
        if rel == "supports":
            supports_map.setdefault(u, set()).add(v)
        elif rel == "contradicts":
            contradicts_map.setdefault(u, set()).add(v)

    for node_key in supports_map:
        if node_key not in contradicts_map:
            continue
        conflicts = supports_map[node_key] & contradicts_map[node_key]
        for target in conflicts:
            entity_type = str(G.nodes.get(node_key, {}).get("entity_type", "unknown"))
            violations.append(
                ShapeViolation(
                    node=node_key,
                    entity_type=entity_type,
                    severity="error",
                    rule="semantic-contradiction",
                    field="supports/contradicts",
                    actual=target,
                    message=(
                        f"'{node_key}'이(가) '{target}'을(를) "
                        f"동시에 지지(supports)하고 반박(contradicts)합니다."
                    ),
                )
            )

    return violations


def check_missing_inverse_relations(G: nx.DiGraph) -> list[ShapeViolation]:
    """역방향 관계가 누락된 경우를 탐지한다.

    예: A가 B를 'uses'하면 B에 'used_in' A가 있어야 한다.
    누락된 역관계를 info 수준 제안으로 반환한다.
    """
    violations: list[ShapeViolation] = []

    # 모든 엣지를 (source, target, relation) 튜플 집합으로 수집
    edge_set: set[tuple[str, str, str]] = set()
    for u, v, data in G.edges(data=True):
        rel = data.get("relation")
        if rel:
            edge_set.add((u, v, rel))

    checked: set[tuple[str, str, str]] = set()
    for u, v, rel in edge_set:
        inverse_rel = INVERSE_RELATIONS.get(rel)
        if not inverse_rel:
            continue

        check_key = (u, v, rel)
        if check_key in checked:
            continue
        checked.add(check_key)

        # 역방향 엣지가 존재하는지 확인
        if (v, u, inverse_rel) not in edge_set:
            violations.append(
                ShapeViolation(
                    node=v,
                    entity_type=str(G.nodes.get(v, {}).get("entity_type", "unknown")),
                    severity="info",
                    rule="missing-inverse-relation",
                    field=inverse_rel,
                    actual=f"{u} --{rel}--> {v}",
                    message=(
                        f"'{u}'이(가) '{v}'에 '{rel}' 관계를 가지지만, "
                        f"역방향 '{inverse_rel}' 관계가 '{v}'에 없습니다."
                    ),
                )
            )

    return violations


def validate_graph_advanced(G: nx.DiGraph) -> list[ShapeViolation]:
    """그래프 수준의 고급 SHACL 검증을 모두 실행한다.

    순환 참조, 카디널리티, 댕글링 참조, 의미적 일관성, 역관계 누락을
    통합 검사하여 ShapeViolation 목록을 반환한다.
    """
    violations: list[ShapeViolation] = []
    violations.extend(check_circular_dependencies(G))
    violations.extend(check_cardinality_constraints(G))
    violations.extend(check_dangling_references(G))
    violations.extend(check_semantic_consistency(G))
    violations.extend(check_missing_inverse_relations(G))
    return violations

