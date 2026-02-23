#!/usr/bin/env python3
"""대시보드 판단 섹션 싱크 — 스코어링 + 판단필요 + 기회탐지"""

import sys, os, re
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from pathlib import Path
from datetime import datetime

VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH not set"); sys.exit(1)
VAULT = Path(VAULT)

from mnemo.opportunity_scorer import score_all_projects
from opportunity_scanner import scan_external_knowledge

today = datetime.now().strftime("%Y-%m-%d")

# Score all projects
scores = score_all_projects()
print(f"Scored {len(scores)} projects")

# Scan opportunities
opps = scan_external_knowledge(days=7)
golden = [o for o in opps if "황금" in o["score"].get("quadrant", "")]
print(f"Found {len(opps)} opportunities, {len(golden)} golden")

# ── Build scores block ──
score_lines = [f"> **Last updated:** {today}\n"]
score_lines.append("| 사분면 | 프로젝트 | 기여 | 수익 | 시너지 | 실현 | 종합 |")
score_lines.append("|--------|----------|------|------|--------|------|------|")
for s in scores:
    score_lines.append(
        f"| {s.quadrant} | **{s.name}** | {s.contribution.score:.0f} "
        f"| {s.revenue.score:.0f} | {s.synergy.score:.0f} "
        f"| {s.feasibility.score:.0f} | **{s.total:.1f}** |"
    )
scores_block = "\n".join(score_lines)

# ── Build action block ──
action_lines = [f"> **Last updated:** {today}\n"]
red = [s for s in scores if "피하기" in s.quadrant]
low = [s for s in scores if s.total < 5.0 and "피하기" not in s.quadrant]

if red:
    action_lines.append("### 🔴 방향 재검토 필요")
    for s in red:
        action_lines.append(f"- **{s.name}** (종합 {s.total:.1f}) — 기여도·수익성 모두 낮음")
    action_lines.append("")

if low:
    action_lines.append("### ⚠️ 낮은 스코어 (5.0 미만)")
    for s in low:
        action_lines.append(f"- **{s.name}** ({s.quadrant}, 종합 {s.total:.1f})")
    action_lines.append("")

if golden:
    action_lines.append(f"### 🟢 황금지대 기회 발견 ({len(golden)}건)")
    for o in golden[:3]:
        os_ = o["score"]
        action_lines.append(
            f"- **{o['title'][:40]}** (종합 {os_['total_score']:.1f}) "
            f"→ {', '.join(o.get('matched_projects', [])[:3])}"
        )
    action_lines.append("")

if not red and not low and not golden:
    action_lines.append("✅ 현재 즉시 판단이 필요한 항목이 없습니다.")

action_block = "\n".join(action_lines)

# ── Build opportunity block ──
opp_lines = [f"> **Last updated:** {today}\n"]
top_opps = opps[:5]
if top_opps:
    opp_lines.append("| 기회 | 사분면 | 종합 | 연관 프로젝트 |")
    opp_lines.append("|------|--------|------|-------------|")
    for o in top_opps:
        os_ = o["score"]
        projs = ", ".join(o.get("matched_projects", [])[:3])
        opp_lines.append(
            f"| {o['title'][:35]} | {os_.get('quadrant', '?')} "
            f"| {os_.get('total_score', 0):.1f} | {projs} |"
        )
else:
    opp_lines.append("이번 주기에 새로운 기회가 탐지되지 않았습니다.")
opp_block = "\n".join(opp_lines)

# ── Sync to dashboards ──
files = [
    VAULT / "01.PROJECT" / "_MASTER_DASHBOARD.md",
    VAULT / "TEMPLATES" / "Dashboard.md",
]

SCORES_RE = re.compile(
    r"(<!-- AUTO:opportunity-scores:START -->)\n.*?\n(<!-- AUTO:opportunity-scores:END -->)",
    re.DOTALL,
)
ACTION_RE = re.compile(
    r"(<!-- AUTO:action-required:START -->)\n.*?\n(<!-- AUTO:action-required:END -->)",
    re.DOTALL,
)
OPP_RE = re.compile(
    r"(<!-- AUTO:recent-opportunities:START -->)\n.*?\n(<!-- AUTO:recent-opportunities:END -->)",
    re.DOTALL,
)

synced = 0
for fp in files:
    if not fp.exists():
        continue
    text = fp.read_text(encoding="utf-8")
    changed = False

    new_text, n = SCORES_RE.subn(rf"\1\n{scores_block}\n\2", text)
    if n > 0 and new_text != text:
        text = new_text
        changed = True

    new_text, n = ACTION_RE.subn(rf"\1\n{action_block}\n\2", text)
    if n > 0 and new_text != text:
        text = new_text
        changed = True

    # Opportunities — Dashboard.md only
    if "TEMPLATES" in str(fp):
        new_text, n = OPP_RE.subn(rf"\1\n{opp_block}\n\2", text)
        if n > 0 and new_text != text:
            text = new_text
            changed = True

    if changed:
        fp.write_text(text, encoding="utf-8")
        synced += 1
        print(f"  Updated: {fp.name}")

print(f"\nDone: {synced} files synced")
