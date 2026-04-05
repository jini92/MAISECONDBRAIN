import json
import re
from pathlib import Path
from datetime import datetime

VAULT = Path(r"C:\Users\jini9\OneDrive\Documents\JINI_SYNC")
STATS_PATH = Path(r"C:\TEST\MAISECONDBRAIN\.mnemo\stats.json")

stats = json.loads(STATS_PATH.read_text(encoding="utf-8"))
et = stats.get("entity_types", {})
hubs = stats.get("top_hubs", [])[:3]

today = datetime.now().strftime("%Y-%m-%d")
hub_top3 = " · ".join(f"[[{n}]] ({d})" for n, d in hubs)
et_top = list(et.items())[:5]
et_rows = "\n".join(f"| {k} | {v:,} |" for k, v in et_top)

block = (
    f"> 📅 {today} · 🗂 **{stats['nodes']:,}** nodes · 🔗 **{stats['edges']:,}** edges\n"
    f"\n"
    f"| 항목 | 값 |\n"
    f"|------|-----|\n"
    f"| 연결 컴포넌트 | {stats.get('weakly_connected_components', '?')} |\n"
    f"| Dangling 노트 | {stats.get('dangling_nodes', '?')} ✅ |\n"
    f"| 밀도 | {stats.get('density', 0):.4f} |\n"
    f"\n"
    f"**주요 엔티티 타입**\n"
    f"| 타입 | 수 |\n"
    f"|------|-----|\n"
    f"{et_rows}\n"
    f"\n"
    f"**Top 허브 노트** (연결 수)\n"
    f"{hub_top3}"
)

marker_re = re.compile(r"(<!-- AUTO:mnemo-stats:START -->)\n.*?\n(<!-- AUTO:mnemo-stats:END -->)", re.DOTALL)
files = [
    VAULT / "01.PROJECT" / "_MASTER_DASHBOARD.md",
    VAULT / "TEMPLATES" / "Dashboard.md",
]
updated = 0
for f in files:
    if not f.exists():
        continue
    text = f.read_text(encoding="utf-8")
    new_text, n = marker_re.subn(rf"\1\n{block}\n\2", text)
    if n > 0 and new_text != text:
        f.write_text(new_text, encoding="utf-8")
        print(f"updated: {f}")
        updated += 1
print(f"total_updated={updated}")
