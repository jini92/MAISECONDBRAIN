"""보강 실제 적용 (type + project)"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

from mnemo.parser import parse_vault
from mnemo.enricher import plan_enrichment, apply_enrichment

import os
VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
notes = parse_vault(VAULT)

plans = plan_enrichment(notes, auto_related=False)
print(f"보강 대상: {len(plans)}개\n")

applied = 0
errors = 0
for plan in plans:
    try:
        result = apply_enrichment(plan, dry_run=False)
        if result and "[APPLIED]" in result:
            applied += 1
            if applied <= 5:
                print(f"  {result}")
            elif applied == 6:
                print("  ...")
    except Exception as e:
        errors += 1
        if errors <= 3:
            print(f"  [ERROR] {plan.path.name}: {e}")

print(f"\n완료: {applied}개 적용, {errors}개 에러")
