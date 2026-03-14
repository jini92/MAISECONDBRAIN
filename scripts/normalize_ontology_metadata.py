from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
import re
from typing import Iterable

import yaml

from mnemo.ontology import classify_entity
from mnemo.ontology_shapes import CORE_ENTITY_TYPES, ENUM_FIELDS, _normalize_type_name
from mnemo.parser import NoteDocument, parse_frontmatter, parse_vault

STATUS_ALIASES = {
    "todo": "active",
    "done": "completed",
    "checked": "completed",
    "in-progress": "active",
    "review-needed": "active",
    "review_needed": "active",
    "inprogress": "active",
}

EXTRA_TYPE_ALIASES = {
    "newsletter": "source",
    "dashboard": "note",
    "memory": "project",
    "action-proposal": "concept",
}

DATE_PATTERNS = [
    re.compile(r"(?<!\d)(20\d{2})[-_.](\d{2})[-_.](\d{2})(?!\d)"),
    re.compile(r"(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)"),
]
URL_RE = re.compile(r'https?://[^\s<>"]+')

LANGUAGE_HINTS = {
    "python", "typescript", "javascript", "java", "kotlin", "swift", "go", "rust", "c++", "c#", "php", "ruby"
}
FRAMEWORK_HINTS = {
    "fastapi", "django", "flask", "react", "next", "nextjs", "express", "vue", "svelte", "tailwind", "shadcn"
}
LIBRARY_HINTS = {"networkx", "numpy", "pandas", "rich", "click", "pyyaml", "pytest", "vitest", "esbuild"}
PLUGIN_HINTS = {"plugin", "obsidian plugin", "extension", "????", "????"}
DATABASE_HINTS = {"postgres", "postgresql", "mysql", "sqlite", "mongodb", "redis", "influxdb", "chromadb", "database"}
MODEL_HINTS = {"gpt", "claude", "gemini", "llama", "qwen", "embedding", "reranker", "model", "llm", "??", "????"}
SERVICE_HINTS = {
    "api", "gateway", "service", "oauth", "auth", "token", "secret", "monitoring", "security", "webhook", "openai", "google places"
}
PLATFORM_HINTS = {"obsidian", "github", "docker", "platform", "openclaw", "railway", "vercel", "cloudflare", "aws", "gcp", "azure", "supabase"}
SOURCE_NOTE_HINTS = {
    "guide", "manual", "reference", "playbook", "template", "checklist", "workflow", "report", "analysis",
    "???", "???", "??", "??", "??", "????", "???", "??",
}
DECISION_CHOSEN_PREFIXES = ("chosen:", "decision:", "selected:", "??:", "??:", "??:")
DECISION_RATIONALE_PREFIXES = ("rationale:", "reason:", "because:", "??:", "??:")


def slug(value: object) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[^a-z0-9+-]+", "-", text).strip("-")


def ensure_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def unique_preserve(values: Iterable[object]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        lowered = text.casefold()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(text)
    return result


def _safe_iso_date(year: str, month: str, day: str) -> str | None:
    try:
        return date(int(year), int(month), int(day)).isoformat()
    except ValueError:
        return None


def infer_date(note: NoteDocument, fm: dict) -> str | None:
    for field_name in ("event_date", "decided", "created", "updated", "create_time"):
        value = fm.get(field_name)
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, str):
            stripped = value.strip()
            if re.match(r"^\d{4}-\d{2}-\d{2}$", stripped):
                return stripped
            for pattern in DATE_PATTERNS:
                match = pattern.search(stripped)
                if match:
                    normalized = _safe_iso_date(*match.groups())
                    if normalized:
                        return normalized

    for candidate in (note.name, note.key, note.path.as_posix()):
        for pattern in DATE_PATTERNS:
            match = pattern.search(candidate)
            if match:
                normalized = _safe_iso_date(*match.groups())
                if normalized:
                    return normalized
    return None


def extract_first_url(text: str) -> str | None:
    match = URL_RE.search(text)
    if not match:
        return None
    url = match.group(0).rstrip(".,;:)]}\"'")
    return url if url.startswith(("http://", "https://")) else None


def infer_source_type(note: NoteDocument, fm: dict) -> str | None:
    source_type = slug(fm.get("source_type", ""))
    if source_type in ENUM_FIELDS["source_type"]:
        return source_type

    url = str(fm.get("url", "") or "").lower()
    body_url = (extract_first_url(note.body) or "").lower()
    haystack = " ".join([
        note.name.lower(),
        str(note.path).lower(),
        " ".join(str(t).lower() for t in note.tags),
        " ".join(str(h).lower() for h in note.headings[:6]),
        url,
        body_url,
    ])

    if any(token in haystack for token in ["youtube", "youtu.be", "vimeo", "video"]):
        return "video"
    if "podcast" in haystack:
        return "podcast"
    if any(token in haystack for token in ["newsletter", "substack"]):
        return "newsletter"
    if any(token in haystack for token in ["arxiv", "doi.org", "/paper", "paper", ".pdf"]):
        return "paper"
    if any(token in haystack for token in ["book", "ebook"]):
        return "book"
    if url.startswith("http") or body_url.startswith("http"):
        return "article"
    if any(token in haystack for token in ["blog", "article", "web"]):
        return "article"
    if any(token in haystack for token in SOURCE_NOTE_HINTS) or any(part.lower() in {"docs", "tasks", "templates", "??"} for part in note.path.parts):
        return "note"
    return None


def infer_tool_category(note: NoteDocument, fm: dict) -> str | None:
    category = slug(fm.get("category", ""))
    if category in ENUM_FIELDS["category"]:
        return category

    haystack = " ".join([
        note.name.lower(),
        str(note.path).lower(),
        " ".join(str(t).lower() for t in note.tags),
        " ".join(str(h).lower() for h in note.headings[:6]),
        str(fm.get("url", "")).lower(),
    ])

    if any(token in haystack for token in PLUGIN_HINTS):
        return "plugin"
    if any(token in haystack for token in LANGUAGE_HINTS):
        return "language"
    if any(token in haystack for token in FRAMEWORK_HINTS):
        return "framework"
    if any(token in haystack for token in DATABASE_HINTS):
        return "database"
    if any(token in haystack for token in MODEL_HINTS):
        return "model"
    if any(token in haystack for token in PLATFORM_HINTS):
        return "platform"
    if any(token in haystack for token in SERVICE_HINTS):
        return "service"
    if any(token in haystack for token in LIBRARY_HINTS):
        return "library"
    if any(token in haystack for token in ["tool", "cli", "sdk", "editor", "??", "??"]):
        return "tool"
    return None


def extract_labeled_value(body: str, prefixes: tuple[str, ...]) -> str | None:
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lowered = stripped.lower()
        for prefix in prefixes:
            if lowered.startswith(prefix):
                value = stripped[len(prefix):].strip(" -:?")
                return value or None
    return None


def should_backfill_type(note: NoteDocument, inferred: str) -> bool:
    if inferred not in CORE_ENTITY_TYPES:
        return False
    if inferred != "note":
        return True
    # Safe scaffold: only add explicit note type when classification already fell
    # through all stronger signals and the file clearly contains note content.
    return bool(note.body.strip())


def build_note_indexes(notes: list[NoteDocument]) -> dict[str, object]:
    notes_by_key = {note.key: note for note in notes}
    backlinks_by_name: dict[str, set[str]] = defaultdict(set)
    project_aliases: dict[str, str] = {}
    name_counts: Counter[str] = Counter(note.name.casefold() for note in notes)

    def register_project_alias(alias: object, target: str) -> None:
        text = str(alias or "").strip()
        if not text:
            return
        project_aliases.setdefault(text.casefold(), target)

    generic_project_note_names = {"kanban", "_kanban", "readme", "dashboard", "_dashboard"}

    for note in notes:
        normalized_type, _ = _normalize_type_name(note.frontmatter.get("type"))
        if normalized_type == "project":
            canonical_project = str(note.frontmatter.get("project") or note.name).strip() or note.name
            use_key_target = (
                canonical_project.casefold() != note.name.casefold()
                or note.name.strip().casefold() in generic_project_note_names
                or name_counts[canonical_project.casefold()] != 1
            )
            project_target = note.key if use_key_target else canonical_project
            register_project_alias(canonical_project, project_target)
            register_project_alias(note.key, project_target)
            register_project_alias(note.frontmatter.get("project"), project_target)
            if note.name.strip().casefold() not in generic_project_note_names:
                register_project_alias(note.name, project_target)
            for alias in ensure_list(note.frontmatter.get("aliases")):
                register_project_alias(alias, project_target)

        for target in note.wiki_links:
            backlinks_by_name[target].add(note.key)
        for relation_targets in note.yaml_relations.values():
            for target in relation_targets:
                backlinks_by_name[target].add(note.key)

    return {
        "notes_by_key": notes_by_key,
        "backlinks_by_name": backlinks_by_name,
        "project_aliases": project_aliases,
    }


def resolve_project_name(value: object, indexes: dict[str, object]) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    project_aliases = indexes["project_aliases"]
    assert isinstance(project_aliases, dict)
    canonical = project_aliases.get(text.casefold())
    return str(canonical) if canonical else None


def infer_related(note: NoteDocument, fm: dict, indexes: dict[str, object]) -> list[str]:
    candidates: list[str] = []
    project_name = resolve_project_name(fm.get("project"), indexes)
    if project_name and project_name.casefold() != note.name.casefold():
        candidates.append(project_name)
    candidates.extend(link for link in note.wiki_links if link.casefold() != note.name.casefold())
    return unique_preserve(candidates)[:5]


def infer_used_in(note: NoteDocument, fm: dict, indexes: dict[str, object]) -> list[str]:
    candidates: list[str] = []
    project_name = resolve_project_name(fm.get("project"), indexes)
    if project_name:
        candidates.append(project_name)

    notes_by_key = indexes["notes_by_key"]
    backlinks_by_name = indexes["backlinks_by_name"]
    assert isinstance(notes_by_key, dict)
    assert isinstance(backlinks_by_name, dict)

    for source_key in sorted(backlinks_by_name.get(note.name, set())):
        source_note = notes_by_key.get(source_key)
        if not isinstance(source_note, NoteDocument):
            continue
        if source_note.key == note.key:
            continue
        normalized_source_type, _ = _normalize_type_name(source_note.frontmatter.get("type"))
        if normalized_source_type == "project":
            linked_project = resolve_project_name(source_note.frontmatter.get("project") or source_note.name, indexes)
            if linked_project:
                candidates.append(linked_project)
            continue
        linked_project = resolve_project_name(source_note.frontmatter.get("project"), indexes)
        if linked_project:
            candidates.append(linked_project)

    return unique_preserve(candidates)[:5]


def merge_list_field(fm: dict, field_name: str, new_values: Iterable[object], changes: list[str], limit: int = 5) -> None:
    existing = ensure_list(fm.get(field_name))
    merged = unique_preserve([*existing, *new_values])[:limit]
    if not merged or merged == existing:
        return
    fm[field_name] = merged
    changes.append(f"{field_name}:+{len(merged) - len(existing)}")


def normalize_used_in_field(fm: dict, indexes: dict[str, object], changes: list[str]) -> None:
    existing = ensure_list(fm.get("used_in"))
    if not existing:
        return
    normalized = unique_preserve(resolve_project_name(value, indexes) for value in existing)
    if normalized == existing:
        return
    if normalized:
        fm["used_in"] = normalized
    else:
        fm.pop("used_in", None)
    changes.append("used_in:normalize")


def update_note(note: NoteDocument, indexes: dict[str, object], dry_run: bool = True) -> list[str]:
    path = note.path
    raw = path.read_text(encoding="utf-8")
    frontmatter, body = parse_frontmatter(raw)
    fm = dict(frontmatter or {})
    changes: list[str] = []

    raw_type = fm.get("type")
    normalized_type, is_canonical = _normalize_type_name(raw_type)
    if raw_type and normalized_type is not None and normalized_type in CORE_ENTITY_TYPES and not is_canonical:
        fm["type"] = normalized_type
        changes.append(f"type:{raw_type}->{normalized_type}")
    elif raw_type and normalized_type not in CORE_ENTITY_TYPES:
        alias = EXTRA_TYPE_ALIASES.get(str(raw_type).strip().lower())
        if alias:
            fm["type"] = alias
            changes.append(f"type:{raw_type}->{alias}")

    if not fm.get("type"):
        inferred = classify_entity(note)
        if should_backfill_type(note, inferred):
            fm["type"] = inferred
            changes.append(f"type:+{inferred}")

    status_value = fm.get("status")
    if status_value is not None:
        normalized_status_key = slug(status_value)
        normalized_status = STATUS_ALIASES.get(normalized_status_key, normalized_status_key)
        if normalized_status in ENUM_FIELDS["status"] and normalized_status != str(status_value).strip().lower():
            fm["status"] = normalized_status
            changes.append(f"status:{status_value}->{normalized_status}")

    confidence_value = fm.get("confidence")
    if confidence_value is not None and slug(confidence_value) not in ENUM_FIELDS["confidence"]:
        try:
            numeric = float(str(confidence_value).strip())
            mapped = "high" if numeric >= 0.75 else "medium" if numeric >= 0.4 else "low"
            fm["confidence"] = mapped
            changes.append(f"confidence:{confidence_value}->{mapped}")
        except ValueError:
            pass

    note_type = str(fm.get("type") or classify_entity(note) or "")

    if note_type == "event":
        if not fm.get("event_date"):
            inferred_date = infer_date(note, fm)
            if inferred_date:
                fm["event_date"] = inferred_date
                changes.append(f"event_date:+{inferred_date}")
        if not any(fm.get(field_name) for field_name in ("participants", "decisions", "related")):
            merge_list_field(fm, "related", infer_related(note, fm, indexes), changes)

    if note_type == "decision":
        if not fm.get("decided"):
            inferred_date = infer_date(note, fm)
            if inferred_date:
                fm["decided"] = inferred_date
                changes.append(f"decided:+{inferred_date}")
        if not fm.get("chosen"):
            chosen = extract_labeled_value(body, DECISION_CHOSEN_PREFIXES)
            if chosen:
                fm["chosen"] = chosen
                changes.append("chosen:+body")
        if not fm.get("rationale"):
            rationale = extract_labeled_value(body, DECISION_RATIONALE_PREFIXES)
            if rationale:
                fm["rationale"] = rationale
                changes.append("rationale:+body")

    if note_type == "source":
        body_url = extract_first_url(body)
        if body_url and not fm.get("url"):
            fm["url"] = body_url
            changes.append(f"url:+{body_url}")
        inferred_source_type = infer_source_type(note, fm)
        if inferred_source_type and fm.get("source_type") != inferred_source_type:
            fm["source_type"] = inferred_source_type
            changes.append(f"source_type:+{inferred_source_type}")

    if note_type == "tool":
        normalize_used_in_field(fm, indexes, changes)
        inferred_category = infer_tool_category(note, fm)
        if inferred_category and fm.get("category") != inferred_category:
            fm["category"] = inferred_category
            changes.append(f"category:+{inferred_category}")
        if not any(fm.get(field_name) for field_name in ("url", "used_in", "alternatives")):
            body_url = extract_first_url(body)
            if body_url and not fm.get("url"):
                fm["url"] = body_url
                changes.append(f"url:+{body_url}")
            if not fm.get("used_in"):
                merge_list_field(fm, "used_in", infer_used_in(note, fm, indexes), changes)

    if not changes:
        return []

    new_fm = yaml.dump(fm, allow_unicode=True, default_flow_style=False, sort_keys=False).strip()
    new_content = f"---\n{new_fm}\n---\n{body.lstrip(chr(10))}"
    if not dry_run:
        path.write_text(new_content, encoding="utf-8")
    return changes


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize Mnemo ontology metadata.")
    parser.add_argument("vault_path")
    parser.add_argument("--memory", dest="memory_path")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    notes = parse_vault(args.vault_path)
    if args.memory_path:
        notes.extend(parse_vault(args.memory_path))

    indexes = build_note_indexes(notes)
    changed_files = 0
    change_counter: Counter[str] = Counter()

    for note in notes:
        changes = update_note(note, indexes, dry_run=args.dry_run)
        if not changes:
            continue
        changed_files += 1
        for change in changes:
            key = change.split(":", 1)[0]
            change_counter[key] += 1

    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"[{mode}] changed_files={changed_files}")
    for key, value in change_counter.most_common():
        print(f"- {key}: {value}")


if __name__ == "__main__":
    main()
