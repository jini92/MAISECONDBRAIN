#!/usr/bin/env python3
"""Cleanup false-positive person stubs (org/role names)."""
from __future__ import annotations

import re
from pathlib import Path

STUB_DIR = Path(r"C:\Users\jini9\OneDrive\Documents\JINI_SYNC\03.RESOURCES\스텁")

DROP_EXACT = {
    "Morgan Stanley",
    "Temasek",
    "Project Manager",
    "프로젝트 매니저",
    "데이터 엔지니어",
    "매니저",
    "레저박스",
    "암펠",
    "삼성E&A",
    "삼성 E&A",
    "삼성물산",
    "엠데이터싱크",
    "원장님",
    "개발사 대표님",
    "개발팀장님",
}

DROP_SUBSTRINGS = [
    "삼성", "엔지니어링", "물산", "중진공", "대학교", "여대",
    "bank", "securities", "insurance", "corporation", "group", "inc", "corp", "ltd", "llc",
]

DROP_PATTERNS = [
    r"(전자|엔지니어링|싱크|대학|여대|공사|은행|증권|보험|그룹|물산)$",
    r"^(Project Manager|Product Manager|Developer|Engineer|Designer)$",
    r"^[가-힣]{2,8}님$",  # role-like honorific
]


def read_heading(path: Path) -> str:
    txt = path.read_text(encoding="utf-8", errors="replace")
    for line in txt.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def main():
    removed = []
    kept = 0

    for p in STUB_DIR.glob("*.md"):
        txt = p.read_text(encoding="utf-8", errors="replace")
        if "type: person" not in txt:
            continue

        heading = read_heading(p)
        if not heading:
            continue

        lower = heading.lower()
        drop = (
            heading in DROP_EXACT
            or any(sub in lower for sub in DROP_SUBSTRINGS)
            or any(re.search(pat, heading, re.IGNORECASE) for pat in DROP_PATTERNS)
        )

        if drop:
            p.unlink(missing_ok=True)
            removed.append((p.name, heading))
        else:
            kept += 1

    print(f"Person stubs kept: {kept}")
    print(f"Removed: {len(removed)}")
    for fn, heading in removed:
        print(f"  - {fn} ({heading})")


if __name__ == "__main__":
    main()
