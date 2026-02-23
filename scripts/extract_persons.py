#!/usr/bin/env python3
"""Phase 3.5 — LLM-based person entity extraction for Mnemo.

- Extract person names from high-priority notes with Ollama
- Create person stub notes in Obsidian vault
- Save extraction summary to .mnemo/persons_extract.json

Usage:
  python scripts/extract_persons.py --max-notes 150 --min-mentions 2 --dry-run
  python scripts/extract_persons.py --max-notes 150 --min-mentions 2 --apply
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

_vault = os.environ.get("MNEMO_VAULT_PATH")
if not _vault:
    print("ERROR: MNEMO_VAULT_PATH not set")
    sys.exit(1)
VAULT = Path(_vault)
STUB_DIR = VAULT / "03.RESOURCES" / "스텁"

EXTRACT_PROMPT = """Extract real PERSON names from the note below.
Return ONLY a JSON array of names. No explanation.

Rules:
- Include only human names (Korean or English)
- Exclude company/org/product/model/project names
- Keep title if attached to a name (e.g., 김철수 매니저)
- If unsure, exclude

Title: {title}
Text:
{content}

JSON array:"""

# exact name blacklist
EXCLUDE_NAMES = {
    # projects / tools
    "maibot", "maioss", "maibeauty", "maiax", "maitok", "maitutor",
    "maibotalks", "maicon", "maistar7", "maisecondbrain", "maipatent",
    "maitalkcart", "maithink", "maitcad", "maitb", "maipnid", "maiupbit",
    "claude", "gpt", "gemini", "ollama", "openai", "anthropic", "google",
    "python", "typescript", "react", "docker", "github", "obsidian",
    "mnemo", "openclaw", "discord", "telegram", "zalo",
    # common non-name tokens
    "admin", "user", "test", "unknown", "none", "null",
    "project manager", "product manager", "developer", "engineer", "designer",
    # org names seen in vault
    "temasek", "morgan stanley", "삼성", "삼성전자", "삼성엔지니어링", "삼성 e&a", "삼성e&a",
    "삼성물산", "엠데이터싱크", "중진공", "한양여대", "뷰티앤팩토리", "bnf",
}

# substring blacklist (if present anywhere, reject)
EXCLUDE_SUBSTRINGS = [
    "삼성", "엔지니어링", "물산", "중진공", "여대", "대학교",
    "bank", "securities", "insurance", "corporation", "group", "inc", "corp", "ltd", "llc",
]

EXCLUDE_PATTERNS = [
    r"(전자|엔지니어링|싱크|대학|여대|공사|은행|증권|보험|그룹|물산)$",
    r"^(project manager|product manager|developer|engineer|designer)$",
    r"(inc\.?|corp\.?|corporation|ltd\.?|llc|group)$",
]

TITLE_SUFFIXES = ["대표", "매니저", "팀장", "부장", "과장", "사원", "엔지니어"]


def _normalize_name(name: str) -> str:
    name = name.strip()
    name = name.strip("{}[]`'\" ")
    name = re.sub(r"^name\s*:\s*", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _is_valid_person_name(name: str) -> bool:
    if not name or len(name) < 2:
        return False

    lower = name.lower()
    if lower in EXCLUDE_NAMES:
        return False
    if any(substr in lower for substr in EXCLUDE_SUBSTRINGS):
        return False
    if any(re.search(pat, lower, re.IGNORECASE) for pat in EXCLUDE_PATTERNS):
        return False

    if re.match(r"^[A-Z]{2,}$", name):
        return False

    # "원장님", "팀장님" 같은 role-only 토큰 제외
    if name.endswith("님") and not re.match(r"^[가-힣]{2,4}님$", name):
        return False

    # Korean: 2~4 chars + optional title
    title_group = "|".join(TITLE_SUFFIXES)
    is_korean = bool(re.match(rf"^[가-힣]{{2,4}}(?:\s*({title_group}))?$", name))

    # English: First Last (or hyphenated)
    is_english = bool(re.match(r"^[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?\s+[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?$", name))

    return is_korean or is_english


def _parse_names_from_llm_output(raw: str) -> list[str]:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    # fenced code blocks
    raw = raw.replace("```json", "```")

    match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if not match:
        return []

    try:
        arr = json.loads(match.group())
    except Exception:
        return []

    names: list[str] = []
    seen = set()
    for item in arr:
        if isinstance(item, dict):
            candidate = _normalize_name(str(item.get("name", "")))
        else:
            candidate = _normalize_name(str(item))

        if not _is_valid_person_name(candidate):
            continue

        k = candidate.lower()
        if k in seen:
            continue
        seen.add(k)
        names.append(candidate)

    return names


def extract_persons_from_note(title: str, content: str, model: str = "llama3.1:8b") -> list[str]:
    import ollama

    prompt = EXTRACT_PROMPT.format(title=title, content=content[:2000])
    try:
        resp = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.1, "num_predict": 300},
        )
        raw = resp.get("message", {}).get("content", "")
        return _parse_names_from_llm_output(raw)
    except Exception as e:
        print(f"  LLM error for {title}: {e}", file=sys.stderr)
        return []


def create_person_stub(name: str, mentioned_in: list[str]) -> Path:
    safe_name = name
    for ch in '<>:"/\\|?*':
        safe_name = safe_name.replace(ch, "_")

    stub_path = STUB_DIR / f"{safe_name}.md"
    if stub_path.exists():
        return stub_path

    related = "\n".join(f"  - '[[{note}]]'" for note in mentioned_in[:10])
    body = [
        "---",
        "type: person",
        "tags:",
        "  - person",
        "  - 자동추출",
        "related:",
        related if related else "  - '[[MAISECONDBRAIN]]'",
        "---",
        "",
        f"# {name}",
        "",
        "> 자동 추출된 인물 스텁. `extract_persons.py` 생성.",
        "",
        "## 언급된 노트",
        "",
    ]
    for note in mentioned_in[:20]:
        body.append(f"- [[{note}]]")

    STUB_DIR.mkdir(parents=True, exist_ok=True)
    stub_path.write_text("\n".join(body), encoding="utf-8")
    return stub_path


def main():
    parser = argparse.ArgumentParser(description="LLM-based person entity extraction")
    parser.add_argument("--max-notes", type=int, default=150)
    parser.add_argument("--model", default="llama3.1:8b")
    parser.add_argument("--min-mentions", type=int, default=2)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    from mnemo.parser import parse_vault

    print(f"=== Person Extraction (model: {args.model}) ===")
    notes = parse_vault(str(VAULT))
    print(f"Parsed {len(notes)} notes")

    # prioritize likely notes
    scored = []
    for n in notes:
        s = 0
        nl = n.name.lower()
        if any(k in nl for k in ["미팅", "meeting", "회의"]):
            s += 3
        if any(k in nl for k in ["브리핑", "리뷰", "review"]):
            s += 2
        if n.frontmatter.get("type") == "event":
            s += 1
        if re.search(r"[가-힣]{2,4}\s*(대표|매니저|팀장|과장|부장|사원|엔지니어|담당)", n.body):
            s += 3
        if re.search(r"[A-Z][a-z]+\s+[A-Z][a-z]+", n.body):
            s += 1
        scored.append((s, n))

    scored.sort(key=lambda x: x[0], reverse=True)
    targets = [n for _, n in scored[: args.max_notes]]
    print(f"Processing top {len(targets)} notes")

    persons_count: Counter = Counter()
    persons_notes: dict[str, list[str]] = {}
    t0 = time.time()

    for i, note in enumerate(targets, 1):
        if i % 20 == 0:
            print(f"  [{i}/{len(targets)}] {time.time()-t0:.0f}s elapsed...")
        persons = extract_persons_from_note(note.name, note.body, model=args.model)
        for p in persons:
            persons_count[p] += 1
            persons_notes.setdefault(p, []).append(note.name)

    elapsed = time.time() - t0
    print(f"\nExtraction complete in {elapsed:.1f}s")
    print(f"  Unique persons: {len(persons_count)}")
    print(f"  Total mentions: {sum(persons_count.values())}")

    qualified = [(n, c) for n, c in persons_count.most_common() if c >= args.min_mentions]
    print(f"\n=== Top Persons (min {args.min_mentions}) ===")
    for n, c in qualified[:30]:
        print(f"  [{c:3d}] {n} → {', '.join(persons_notes[n][:3])}")

    print(f"\nQualified for stubs: {len(qualified)}")

    if args.apply and qualified:
        created = 0
        for name, _ in qualified:
            create_person_stub(name, persons_notes[name])
            created += 1
        print(f"Created/updated: {created} person stubs")
    elif args.dry_run:
        print("[DRY RUN] no files written")

    result = {
        "total_notes": len(targets),
        "unique_persons": len(persons_count),
        "qualified": len(qualified),
        "top_persons": [{"name": n, "mentions": c} for n, c in qualified[:50]],
        "elapsed_seconds": round(elapsed, 1),
    }
    out = PROJECT_ROOT / ".mnemo" / "persons_extract.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Results saved: {out}")


if __name__ == "__main__":
    main()
