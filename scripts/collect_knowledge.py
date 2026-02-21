"""외부 지식 수집 실행 스크립트"""
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, "src")

import os
import time
from mnemo.collectors.knowledge_pipeline import (
    collect_all_projects,
    save_to_vault,
)

VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
BRAVE_KEY = os.environ.get("BRAVE_API_KEY", "")

print("=" * 50)
print("🌐 Mnemo External Knowledge Collection")
print("=" * 50)

# 프로젝트 선택 (인자로 지정 가능)
projects = sys.argv[1:] if len(sys.argv) > 1 else None
if projects:
    print(f"  Projects: {', '.join(projects)}")
else:
    print("  Projects: ALL")

if not BRAVE_KEY:
    print("  ⚠️ BRAVE_API_KEY not set — web search disabled, YouTube only")

t0 = time.time()
knowledge = collect_all_projects(
    brave_api_key=BRAVE_KEY or None,
    projects=projects,
)

print(f"\n수집 결과: {len(knowledge)}개 토픽")
for k in knowledge:
    print(f"  [{k.project}] {k.topic}: {len(k.results)}개 결과")

# 볼트에 저장
saved = save_to_vault(knowledge, VAULT)
elapsed = time.time() - t0

print(f"\n✅ {len(saved)}개 노트 저장 ({elapsed:.1f}s)")
for p in saved[:5]:
    print(f"  → {p.name}")
if len(saved) > 5:
    print(f"  ... +{len(saved)-5}개")

print(f"\n경로: {VAULT}/03.RESOURCES/외부지식/")
