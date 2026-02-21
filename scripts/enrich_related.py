"""related 관계 자동 추론 + 적용"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

import time
from collections import Counter
from mnemo.parser import parse_vault
from mnemo.enricher import plan_enrichment, apply_enrichment

import os
VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
print("Parsing...")
notes = parse_vault(VAULT)
print(f"  {len(notes)} notes")

# related가 없는 노트만 대상
candidates = [n for n in notes if not n.frontmatter.get("related")]
print(f"  related 없는 노트: {len(candidates)}")

print("\nInferring related links (태그 겹침 + 프로젝트 + 날짜)...")
t0 = time.time()
plans = plan_enrichment(candidates, auto_related=True)
related_plans = [p for p in plans if p.add_related]
elapsed = time.time() - t0
print(f"  {len(related_plans)}개 노트에 related 추론 ({elapsed:.1f}s)")

# 통계
total_rels = sum(len(p.add_related) for p in related_plans)
print(f"  총 {total_rels}개 관계 발견")

# 샘플
print("\n=== 샘플 ===")
for plan in related_plans[:5]:
    print(f"\n  {plan.path.name}:")
    for r in plan.add_related:
        print(f"    → {r}")

# 적용
print(f"\n적용 중...")
applied = 0
for plan in related_plans:
    # related만 적용 (type/project는 이미 적용됨)
    plan.add_type = None
    plan.add_project = None
    try:
        result = apply_enrichment(plan, dry_run=False)
        if result and "[APPLIED]" in result:
            applied += 1
    except Exception as e:
        pass

print(f"완료: {applied}개 적용")
