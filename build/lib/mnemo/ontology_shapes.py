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

