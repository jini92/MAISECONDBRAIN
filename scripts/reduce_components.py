"""그래프 Components 감소 스크립트 — 고립 노드를 메인 그래프에 연결"""
import sys, os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "src")

import pickle
import collections
import networkx as nx
from pathlib import Path

CACHE_DIR = str(Path(__file__).resolve().parent.parent / ".mnemo")
GRAPH_PATH = os.path.join(CACHE_DIR, "graph.pkl")


def load_graph():
    with open(GRAPH_PATH, "rb") as f:
        return pickle.load(f)


def save_graph(G):
    with open(GRAPH_PATH, "wb") as f:
        pickle.dump(G, f)


def get_main_component(G):
    """가장 큰 컴포넌트의 노드 집합"""
    comps = list(nx.weakly_connected_components(G))
    return max(comps, key=len) if comps else set()


def get_isolated_nodes(G, main_comp):
    """메인 컴포넌트에 속하지 않는 노드"""
    return set(G.nodes()) - main_comp


def strategy_tag_bridge(G, isolated, main_comp):
    """전략 A: 태그 기반 — 고립 노드와 같은 태그를 가진 메인 컴포넌트 노드 연결"""
    # 메인 컴포넌트의 태그 → 노드 매핑
    tag_to_main = collections.defaultdict(list)
    for n in main_comp:
        tags = G.nodes[n].get("tags", [])
        if tags:
            for t in tags:
                tag_to_main[t.lower()].append(n)

    edges_added = 0
    connected = set()
    for n in isolated:
        tags = G.nodes[n].get("tags", [])
        if not tags:
            continue
        best_target = None
        best_shared = 0
        for t in tags:
            candidates = tag_to_main.get(t.lower(), [])
            for c in candidates[:3]:  # 상위 3개만 확인
                shared = len(set(t2.lower() for t2 in G.nodes[c].get("tags", [])) &
                             set(t2.lower() for t2 in tags))
                if shared > best_shared:
                    best_shared = shared
                    best_target = c
        if best_target and best_shared >= 2:  # 최소 2개 태그 공유
            if not G.has_edge(n, best_target):
                G.add_edge(n, best_target, type="tag_shared", weight=0.3, auto_linked=True)
                edges_added += 1
                connected.add(n)
    return edges_added, connected


def strategy_folder_bridge(G, isolated, main_comp):
    """전략 B: 같은 폴더의 노드끼리 연결 — 고립 노드를 같은 폴더의 메인 컴포넌트 노드에 연결"""
    folder_to_main = collections.defaultdict(list)
    for n in main_comp:
        path = G.nodes[n].get("path", "")
        if path:
            folder = str(Path(path).parent)
            folder_to_main[folder].append(n)

    edges_added = 0
    connected = set()
    for n in isolated:
        path = G.nodes[n].get("path", "")
        if not path:
            continue
        folder = str(Path(path).parent)
        candidates = folder_to_main.get(folder, [])
        if candidates:
            # 가장 degree가 높은 노드에 연결
            target = max(candidates[:10], key=lambda c: G.degree(c))
            if not G.has_edge(n, target):
                G.add_edge(n, target, type="folder_shared", weight=0.2, auto_linked=True)
                edges_added += 1
                connected.add(n)
    return edges_added, connected


def strategy_merge_small_components(G, main_comp):
    """전략 C: 작은 컴포넌트(2-5)를 메인에 연결 — 컴포넌트 내 노드 중 태그가 있는 것을 메인에 브릿지"""
    comps = list(nx.weakly_connected_components(G))
    small_comps = [c for c in comps if 2 <= len(c) <= 10 and c != main_comp]

    tag_to_main = collections.defaultdict(list)
    for n in main_comp:
        for t in G.nodes[n].get("tags", []):
            tag_to_main[t.lower()].append(n)

    edges_added = 0
    for comp in small_comps:
        # 컴포넌트에서 태그가 가장 많은 노드 선택
        best_node = max(comp, key=lambda n: len(G.nodes[n].get("tags", [])))
        tags = G.nodes[best_node].get("tags", [])
        if not tags:
            continue
        # 메인에서 가장 많이 겹치는 노드 찾기
        for t in tags:
            candidates = tag_to_main.get(t.lower(), [])
            if candidates:
                target = candidates[0]
                if not G.has_edge(best_node, target):
                    G.add_edge(best_node, target, type="tag_shared", weight=0.25, auto_linked=True)
                    edges_added += 1
                    break
    return edges_added


def strategy_remove_garbage_nodes(G):
    """전략 D: 쓸모없는 dangling 노드 제거 (이미지, 코드 조각 등)"""
    IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".pdf"}
    to_remove = []
    for n, d in G.nodes(data=True):
        if "entity_type" not in d:  # dangling node
            name = n.lower()
            # 이미지 참조
            if any(name.endswith(ext) for ext in IMAGE_EXTS):
                to_remove.append(n)
                continue
            # 코드/기호 조각 (노드 이름에 특수문자가 많으면)
            special = sum(1 for c in n if c in '<>{}[]()=|&;,"\'\n\t')
            if special > 3 or len(n) > 200:
                to_remove.append(n)
                continue
    G.remove_nodes_from(to_remove)
    return len(to_remove)


def reduce_components(G):
    """모든 전략 실행"""
    print("=== Component Reduction ===")

    # Before stats
    comps_before = nx.number_weakly_connected_components(G)
    nodes_before = G.number_of_nodes()
    edges_before = G.number_of_edges()

    # D: 가비지 노드 제거
    removed = strategy_remove_garbage_nodes(G)
    print(f"  Strategy D (garbage removal): {removed} nodes removed")

    main_comp = get_main_component(G)
    isolated = get_isolated_nodes(G, main_comp)
    print(f"  Isolated nodes: {len(isolated)}")

    # A: 태그 기반
    added_a, connected_a = strategy_tag_bridge(G, isolated, main_comp)
    print(f"  Strategy A (tag bridge): {added_a} edges, {len(connected_a)} nodes connected")

    # 메인 컴포넌트 갱신
    main_comp = get_main_component(G)
    isolated = get_isolated_nodes(G, main_comp)

    # B: 폴더 기반
    added_b, connected_b = strategy_folder_bridge(G, isolated, main_comp)
    print(f"  Strategy B (folder bridge): {added_b} edges, {len(connected_b)} nodes connected")

    # C: 작은 컴포넌트 병합
    main_comp = get_main_component(G)
    added_c = strategy_merge_small_components(G, main_comp)
    print(f"  Strategy C (small comp merge): {added_c} edges")

    # After stats
    comps_after = nx.number_weakly_connected_components(G)
    print(f"\n  Before: {comps_before} components, {nodes_before} nodes, {edges_before} edges")
    print(f"  After:  {comps_after} components, {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    print(f"  Reduction: {comps_before - comps_after} components")

    return {
        "before": {"components": comps_before, "nodes": nodes_before, "edges": edges_before},
        "after": {"components": comps_after, "nodes": G.number_of_nodes(), "edges": G.number_of_edges()},
    }


if __name__ == "__main__":
    G = load_graph()
    result = reduce_components(G)
    save_graph(G)
    print("\nGraph saved.")
