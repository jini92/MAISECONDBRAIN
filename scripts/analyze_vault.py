"""볼트 구조 분석 — 지식그래프 최적화를 위한 현황 파악"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

from collections import Counter
from pathlib import Path
import os
from mnemo.parser import parse_vault

VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
notes = parse_vault(VAULT)

print(f"총 노트: {len(notes)}\n")

# 1. Frontmatter 현황
has_fm = [n for n in notes if n.frontmatter]
has_tags = [n for n in notes if n.tags]
has_type = [n for n in notes if n.frontmatter.get("type")]
has_related = [n for n in notes if n.frontmatter.get("related") or n.frontmatter.get("links")]
has_aliases = [n for n in notes if n.frontmatter.get("aliases")]

print("=== Frontmatter 현황 ===")
print(f"  Frontmatter 있음: {len(has_fm)} ({len(has_fm)*100//len(notes)}%)")
print(f"  tags 있음: {len(has_tags)} ({len(has_tags)*100//len(notes)}%)")
print(f"  type 있음: {len(has_type)} ({len(has_type)*100//len(notes)}%)")
print(f"  related/links 있음: {len(has_related)} ({len(has_related)*100//len(notes)}%)")
print(f"  aliases 있음: {len(has_aliases)} ({len(has_aliases)*100//len(notes)}%)")

# 2. 태그 분포
all_tags = Counter()
for n in notes:
    for t in n.tags:
        all_tags[t] += 1
print(f"\n=== 태그 분포 (총 {len(all_tags)}종) ===")
for tag, count in all_tags.most_common(20):
    print(f"  {tag}: {count}")

# 3. 폴더별 분포
folder_counts = Counter()
for n in notes:
    parts = Path(n.path).relative_to(VAULT).parts
    if parts:
        folder_counts[parts[0]] += 1
print(f"\n=== 폴더별 분포 ===")
for folder, count in folder_counts.most_common(20):
    print(f"  {folder}: {count}")

# 4. 위키링크 현황
has_links = [n for n in notes if n.wiki_links]
link_counts = [len(n.wiki_links) for n in notes]
print(f"\n=== 위키링크 현황 ===")
print(f"  위키링크 있는 노트: {len(has_links)} ({len(has_links)*100//len(notes)}%)")
print(f"  평균 링크 수: {sum(link_counts)/len(notes):.1f}")
print(f"  최대 링크 수: {max(link_counts)}")

# 5. 본문 길이 분포
body_lens = [len(n.body) for n in notes]
short = sum(1 for l in body_lens if l < 100)
medium = sum(1 for l in body_lens if 100 <= l < 1000)
long = sum(1 for l in body_lens if 1000 <= l < 5000)
vlong = sum(1 for l in body_lens if l >= 5000)
print(f"\n=== 본문 길이 분포 ===")
print(f"  <100자 (매우 짧음): {short}")
print(f"  100~1000자: {medium}")
print(f"  1000~5000자: {long}")
print(f"  5000자+: {vlong}")

# 6. Frontmatter 키 분포
fm_keys = Counter()
for n in notes:
    for k in n.frontmatter.keys():
        fm_keys[k] += 1
print(f"\n=== Frontmatter 키 분포 ===")
for key, count in fm_keys.most_common(20):
    print(f"  {key}: {count}")
