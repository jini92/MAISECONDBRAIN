"""Unknown 타입 노드 분류 스크립트 — dangling 노드에 entity_type 부여"""
import sys, os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "src")

import pickle
import re
from pathlib import Path

CACHE_DIR = str(Path(__file__).resolve().parent.parent / ".mnemo")
GRAPH_PATH = os.path.join(CACHE_DIR, "graph.pkl")


def load_graph():
    with open(GRAPH_PATH, "rb") as f:
        return pickle.load(f)


def save_graph(G):
    with open(GRAPH_PATH, "wb") as f:
        pickle.dump(G, f)


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

# 확장자 기반 분류
EXT_TYPE_MAP = {
    ".pdf": "source",
    ".xlsx": "source",
    ".docx": "source",
    ".pptx": "source",
    ".csv": "source",
}

# 키워드 기반 분류
KEYWORD_RULES = [
    (["참고", "출처", "링크", "reference", "source"], "source"),
    (["결정", "합의", "decision", "policy"], "decision"),
    (["인사이트", "발견", "insight", "lesson"], "insight"),
    (["프로젝트", "project", "mai"], "project"),
    (["회의", "meeting", "daily"], "event"),
]


def classify_node(name: str) -> str:
    """노드 이름만으로 타입 추론"""
    name_lower = name.lower()

    # 이미지 → 제거 대상이므로 "media"
    if any(name_lower.endswith(ext) for ext in IMAGE_EXTS):
        return "media"

    # 확장자 기반
    for ext, etype in EXT_TYPE_MAP.items():
        if name_lower.endswith(ext):
            return etype

    # 날짜 패턴 → event
    if DATE_RE.search(name):
        return "event"

    # 폴더 힌트 (경로에 포함된 경우)
    if "resource" in name_lower or "03." in name_lower:
        return "source"
    if "project" in name_lower or "01." in name_lower:
        return "project"
    if "daily" in name_lower or "00." in name_lower:
        return "event"
    if "archive" in name_lower or "04." in name_lower:
        return "note"

    # 키워드 기반
    for keywords, etype in KEYWORD_RULES:
        if any(kw in name_lower for kw in keywords):
            return etype

    # 기본값
    return "note"


def classify_unknowns(G):
    """entity_type이 없는 노드에 타입 부여"""
    print("=== Unknown Node Classification ===")

    unknowns = [(n, d) for n, d in G.nodes(data=True) if "entity_type" not in d]
    print(f"  Nodes without entity_type: {len(unknowns)}")

    classified = {"media": 0, "note": 0, "event": 0, "source": 0, "project": 0,
                  "decision": 0, "insight": 0}

    for n, d in unknowns:
        etype = classify_node(n)
        d["entity_type"] = etype
        classified[etype] = classified.get(etype, 0) + 1

    print(f"  Classification results:")
    for etype, count in sorted(classified.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"    {etype}: {count}")

    remaining = sum(1 for _, d in G.nodes(data=True) if "entity_type" not in d)
    print(f"  Remaining without type: {remaining}")

    return classified


if __name__ == "__main__":
    G = load_graph()
    result = classify_unknowns(G)
    save_graph(G)
    print("\nGraph saved.")
