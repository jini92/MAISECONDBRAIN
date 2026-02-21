"""Generate stub notes for dangling references in the knowledge graph."""
import argparse
import pickle
import os
import sys
from collections import Counter
from datetime import date
from pathlib import Path


def load_graph(cache_dir: str):
    graph_path = os.path.join(cache_dir, "graph.pkl")
    with open(graph_path, "rb") as f:
        return pickle.load(f)


def find_dangling(g, top_n: int = 50):
    """Find dangling nodes (no path attr) ranked by in-degree."""
    dangling_set = {n for n, d in g.nodes(data=True) if not d.get("path")}
    in_deg = Counter()
    sources: dict[str, list[str]] = {}
    for u, v in g.edges():
        if v in dangling_set:
            in_deg[v] += 1
            sources.setdefault(v, []).append(u)
    ranked = in_deg.most_common(top_n)
    return [(name, cnt, sources.get(name, [])) for name, cnt in ranked]


def is_image_ref(name: str) -> bool:
    """Skip image file references."""
    lower = name.lower()
    return any(lower.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"))


def file_exists_in_vault(vault_dir: str, name: str) -> bool:
    """Check if a note with this name already exists anywhere in the vault."""
    # Check exact path in stub dir
    stub_path = os.path.join(vault_dir, "03.RESOURCES", "스텁", f"{name}.md")
    if os.path.exists(stub_path):
        return True
    # Walk vault for any .md with same stem
    for root, dirs, files in os.walk(vault_dir):
        for f in files:
            if f == f"{name}.md":
                return True
    return False


def generate_stub_content(name: str, source_notes: list[str]) -> str:
    today = date.today().isoformat()
    refs = "\n".join(f"- [[{s}]]" for s in sorted(set(source_notes)))
    return f"""---
type: stub
tags: [auto-generated]
created: {today}
---
# {name}

> 이 노트는 자동 생성된 스텁입니다. 내용을 추가해주세요.

## 참조하는 노트
{refs}
"""


def main():
    parser = argparse.ArgumentParser(description="Generate stub notes for dangling references")
    parser.add_argument("--vault", default=r"~/vault")
    parser.add_argument("--cache-dir", default=r".\.mnemo")
    parser.add_argument("--top", type=int, default=50)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    g = load_graph(args.cache_dir)
    dangling = find_dangling(g, args.top)

    stub_dir = os.path.join(args.vault, "03.RESOURCES", "스텁")
    os.makedirs(stub_dir, exist_ok=True)

    created = 0
    skipped_exists = 0
    skipped_image = 0

    for name, count, source_notes in dangling:
        if is_image_ref(name):
            skipped_image += 1
            continue
        if file_exists_in_vault(args.vault, name):
            skipped_exists += 1
            if args.dry_run:
                print(f"  SKIP (exists): {name}")
            continue

        stub_path = os.path.join(stub_dir, f"{name}.md")
        # Sanitize filename - replace chars invalid in Windows filenames
        safe_name = name
        for ch in '<>:"/\\|?*':
            safe_name = safe_name.replace(ch, '_')
        stub_path = os.path.join(stub_dir, f"{safe_name}.md")

        content = generate_stub_content(name, source_notes)

        if args.dry_run:
            print(f"  CREATE: {safe_name}.md ({count} refs)")
        else:
            with open(stub_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  Created: {safe_name}.md ({count} refs)")
            created += 1

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Summary: {created if not args.dry_run else 'N/A'} created, {skipped_exists} skipped (exists), {skipped_image} skipped (image)")


if __name__ == "__main__":
    main()
