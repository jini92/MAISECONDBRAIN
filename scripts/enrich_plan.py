"""보강 계획 미리보기 (dry run)"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

from collections import Counter
from mnemo.parser import parse_vault
from mnemo.enricher import plan_enrichment

import os
VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
notes = parse_vault(VAULT)

plans = plan_enrichment(notes, auto_related=False)

print(f"총 노트: {len(notes)}")
print(f"보강 대상: {len(plans)} ({len(plans)*100//len(notes)}%)\n")

# 변경 유형별 집계
change_types = Counter()
for plan in plans:
    for c in plan.changes:
        key = c.split(":")[0]
        change_types[key] += 1

print("=== 변경 유형별 ===")
for ct, count in change_types.most_common():
    print(f"  {ct}: {count}개")

# type 추론 결과
type_values = Counter()
for plan in plans:
    if plan.add_type:
        type_values[plan.add_type] += 1

print(f"\n=== 추론된 type 분포 ===")
for t, count in type_values.most_common():
    print(f"  {t}: {count}")

# project 추론 결과
proj_values = Counter()
for plan in plans:
    if plan.add_project:
        proj_values[plan.add_project] += 1

print(f"\n=== 추론된 project 분포 ===")
for p, count in proj_values.most_common():
    print(f"  {p}: {count}")

# 샘플 출력
print(f"\n=== 샘플 (처음 10개) ===")
for plan in plans[:10]:
    print(f"  {plan.path.name}: {', '.join(plan.changes)}")
