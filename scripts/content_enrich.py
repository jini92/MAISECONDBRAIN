"""콘텐츠 기반 태그 + 백링크 자동 보강"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

import time
from collections import Counter
from mnemo.parser import parse_vault
from mnemo.content_linker import analyze_all, apply_content_enrichment

import os
VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
print("Parsing vault...")
notes = parse_vault(VAULT)
print(f"  {len(notes)} notes\n")

print("Analyzing content...")
t0 = time.time()
enrichments = analyze_all(notes)
elapsed = time.time() - t0
print(f"  {len(enrichments)} notes with changes ({elapsed:.1f}s)\n")

# 통계
tag_count = sum(len(e.new_tags) for e in enrichments)
proj_count = sum(1 for e in enrichments if e.new_project)
link_count = sum(len(e.new_backlinks) for e in enrichments)

print(f"=== 발견된 보강 ===")
print(f"  새 태그: {tag_count}개 (across {sum(1 for e in enrichments if e.new_tags)} notes)")
print(f"  새 프로젝트: {proj_count}개")
print(f"  새 백링크: {link_count}개 (across {sum(1 for e in enrichments if e.new_backlinks)} notes)")

# 태그 분포
all_new_tags = Counter()
for e in enrichments:
    for t in e.new_tags:
        all_new_tags[t] += 1
print(f"\n=== 추가될 태그 분포 ===")
for tag, count in all_new_tags.most_common(15):
    print(f"  {tag}: {count}")

# 백링크 샘플
linked_notes = [e for e in enrichments if e.new_backlinks]
if linked_notes:
    print(f"\n=== 백링크 샘플 ===")
    for e in linked_notes[:5]:
        print(f"\n  [{e.name}]:")
        for bl in e.new_backlinks[:3]:
            print(f"    → [[{bl}]]")

# 적용
print(f"\n적용 중...")
applied = 0
errors = 0
for e in enrichments:
    try:
        result = apply_content_enrichment(e, dry_run=False)
        if result and "[OK]" in result:
            applied += 1
    except Exception as ex:
        errors += 1
        if errors <= 3:
            print(f"  ERROR: {e.name}: {ex}")

print(f"\n✅ 완료: {applied}개 적용, {errors}개 에러")
print(f"   태그 {tag_count}개 + 백링크 {link_count}개 추가됨")
