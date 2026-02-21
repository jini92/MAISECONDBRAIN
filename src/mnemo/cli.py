"""Mnemo CLI — mnemo build, mnemo stats, mnemo neighbors"""

from __future__ import annotations

import time
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from .cache import BuildCache
from .graph_builder import build_graph, graph_stats
from .parser import parse_vault

console = Console(force_terminal=True, force_jupyter=False)

# 프로젝트 루트 기준 캐시 디렉토리 (CWD 무관하게 일관된 경로)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_CACHE_DIR = str(_PROJECT_ROOT / ".mnemo")


@click.group()
def main():
    """🧠 Mnemo — 개인화 세컨드브레인 GraphRAG 엔진"""
    pass


@main.command()
@click.argument("vault_path")
@click.option("--cache-dir", default=DEFAULT_CACHE_DIR, help="캐시 디렉토리")
@click.option("--tag-edges", is_flag=True, help="태그 공유 엣지 포함")
@click.option("--include-memory", default=None, help="MAIBOT memory 경로 추가")
def build(vault_path: str, cache_dir: str, tag_edges: bool, include_memory: str | None):
    """볼트를 파싱하고 지식그래프를 빌드합니다."""
    cache = BuildCache(cache_dir)

    console.print(f"\n[bold blue]🧠 Mnemo Build[/bold blue]")
    console.print(f"  Vault: {vault_path}")

    # 파싱
    t0 = time.time()
    console.print("  [dim]파싱 중...[/dim]", end="")
    notes = parse_vault(vault_path)

    # MAIBOT memory 추가
    if include_memory:
        memory_notes = parse_vault(include_memory)
        notes.extend(memory_notes)
        console.print(f" +{len(memory_notes)} memory files", end="")

    t_parse = time.time() - t0
    console.print(f"  ✅ {len(notes)}개 노트 파싱 ({t_parse:.1f}s)")

    # 변경 감지
    current_checksums = {n.key: n.checksum for n in notes}
    added, modified, deleted = cache.get_changed_files(current_checksums)
    if added or modified or deleted:
        console.print(f"  [yellow]변경: +{len(added)} ~{len(modified)} -{len(deleted)}[/yellow]")
    else:
        console.print("  [green]변경 없음 (캐시 갱신)[/green]")

    # 그래프 빌드
    t1 = time.time()
    console.print("  [dim]그래프 빌드 중...[/dim]", end="")
    G = build_graph(notes, include_tag_edges=tag_edges)
    t_build = time.time() - t1
    console.print(f"  ✅ {G.number_of_nodes()} 노드, {G.number_of_edges()} 엣지 ({t_build:.1f}s)")

    # 통계
    stats = graph_stats(G)

    # 캐시 저장
    cache.save_checksums(current_checksums)
    cache.save_graph(G)
    cache.save_stats(stats)
    console.print(f"  [dim]캐시 저장: {cache_dir}/[/dim]")

    # 요약 출력
    _print_build_summary(stats)
    console.print(f"\n  [bold green]총 소요: {time.time() - t0:.1f}s[/bold green]\n")


@main.command()
@click.option("--cache-dir", default=DEFAULT_CACHE_DIR, help="캐시 디렉토리")
def stats(cache_dir: str):
    """저장된 그래프의 통계를 출력합니다."""
    cache = BuildCache(cache_dir)
    saved_stats = cache.load_stats()

    if not saved_stats:
        console.print("[red]캐시된 통계 없음. 먼저 `mnemo build`를 실행하세요.[/red]")
        return

    _print_build_summary(saved_stats)


@main.command()
@click.argument("node_name")
@click.option("--hops", default=2, help="탐색 깊이")
@click.option("--cache-dir", default=DEFAULT_CACHE_DIR, help="캐시 디렉토리")
def neighbors(node_name: str, hops: int, cache_dir: str):
    """특정 노드의 이웃을 탐색합니다."""
    import networkx as nx

    cache = BuildCache(cache_dir)
    G = cache.load_graph()

    if G is None:
        console.print("[red]캐시된 그래프 없음. 먼저 `mnemo build`를 실행하세요.[/red]")
        return

    if node_name not in G:
        # 부분 매칭
        matches = [n for n in G.nodes() if node_name.lower() in n.lower()]
        if not matches:
            console.print(f"[red]'{node_name}' 노드를 찾을 수 없습니다.[/red]")
            return
        if len(matches) > 10:
            console.print(f"[yellow]{len(matches)}개 후보 중 상위 10개:[/yellow]")
            for m in matches[:10]:
                console.print(f"  • {m}")
            return
        if len(matches) == 1:
            node_name = matches[0]
            console.print(f"[dim]→ '{node_name}'[/dim]")
        else:
            console.print(f"[yellow]후보:[/yellow]")
            for m in matches:
                console.print(f"  • {m}")
            return

    # ego_graph로 N-hop 서브그래프
    sub = nx.ego_graph(G, node_name, radius=hops, undirected=True)

    table = Table(title=f"🔗 '{node_name}' 이웃 ({hops}홉, {sub.number_of_nodes()-1}개)")
    table.add_column("노드", style="cyan")
    table.add_column("타입", style="green")
    table.add_column("관계", style="yellow")
    table.add_column("홉", style="dim")

    # BFS로 홉 거리 계산
    distances = nx.single_source_shortest_path_length(
        G.to_undirected(), node_name, cutoff=hops
    )

    for neighbor, dist in sorted(distances.items(), key=lambda x: x[1]):
        if neighbor == node_name:
            continue
        data = G.nodes.get(neighbor, {})
        entity_type = data.get("entity_type", "?")

        # 직접 연결 엣지 타입
        edge_types = set()
        if G.has_edge(node_name, neighbor):
            edge_types.add(G.edges[node_name, neighbor].get("type", "?"))
        if G.has_edge(neighbor, node_name):
            edge_types.add(G.edges[neighbor, node_name].get("type", "?"))

        rel_str = ", ".join(edge_types) if edge_types else "indirect"
        table.add_row(neighbor, entity_type, rel_str, str(dist))

    console.print(table)


@main.command()
@click.argument("question")
@click.option("--cache-dir", default=DEFAULT_CACHE_DIR, help="캐시 디렉토리")
@click.option("--top-k", default=5, help="검색 결과 수")
@click.option("--hops", default=2, help="그래프 확장 깊이")
def query(question: str, cache_dir: str, top_k: int, hops: int):
    """자연어로 지식그래프에 질의합니다."""
    from .cache import BuildCache
    from .embedder import EmbeddingCache
    from .graphrag import query as graphrag_query

    cache = BuildCache(cache_dir)
    emb_cache = EmbeddingCache(cache_dir)
    G = cache.load_graph()

    if G is None:
        console.print("[red]캐시된 그래프 없음. 먼저 `mnemo build`를 실행하세요.[/red]")
        return

    embeddings = emb_cache.load()

    # 노트 내용 로드
    notes_content = {}
    for node, data in G.nodes(data=True):
        path = data.get("path")
        if path and Path(path).exists():
            try:
                notes_content[node] = Path(path).read_text(encoding="utf-8")[:5000]
            except Exception:
                pass

    # 질문 임베딩 (Ollama)
    query_embedding = None
    if embeddings:
        try:
            import ollama
            import numpy as np
            resp = ollama.embed(model="nomic-embed-text", input=question[:2000])
            query_embedding = np.array(resp["embeddings"][0], dtype=np.float32)
        except Exception:
            pass

    console.print(f"\n[bold blue]🧠 Query:[/bold blue] {question}")
    console.print(f"  [dim]Graph: {G.number_of_nodes()} nodes | Embeddings: {len(embeddings)}[/dim]\n")

    result = graphrag_query(
        question=question,
        G=G,
        embeddings=embeddings,
        notes_content=notes_content,
        query_embedding=query_embedding,
        top_k=top_k,
        hops=hops,
    )

    # 소스 테이블
    if result.sources:
        src_table = Table(title="📚 관련 노트")
        src_table.add_column("#", style="dim", width=3)
        src_table.add_column("노트", style="cyan")
        src_table.add_column("타입", style="green")
        src_table.add_column("점수", style="yellow", justify="right")
        for i, src in enumerate(result.sources, 1):
            src_table.add_row(str(i), src["name"], src["entity_type"], f"{src['combined_score']:.3f}")
        console.print(src_table)
        console.print(f"\n  [dim]확장된 노드: {result.expanded_nodes}[/dim]")


@main.command()
@click.option("--cache-dir", default=DEFAULT_CACHE_DIR, help="캐시 디렉토리")
@click.option("--port", default=7890, help="서버 포트")
@click.option("--host", default="127.0.0.1", help="바인딩 호스트")
def serve(cache_dir: str, port: int, host: str):
    """FastAPI GraphRAG 서버를 시작합니다."""
    from .api import app, load_state

    console.print(f"\n[bold blue]Mnemo API Server[/bold blue]")
    console.print(f"  Loading cache from {cache_dir}...")

    if not load_state(cache_dir):
        console.print("[red]캐시 로드 실패. 먼저 `mnemo build`를 실행하세요.[/red]")
        return

    console.print(f"  Starting server on {host}:{port}")
    console.print(f"  Docs: http://{host}:{port}/docs\n")

    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")


def _print_build_summary(stats: dict):
    """빌드 통계 요약 테이블 출력"""
    # 기본 정보
    table = Table(title="📊 그래프 통계")
    table.add_column("항목", style="cyan")
    table.add_column("값", style="white")

    table.add_row("노드", str(stats.get("nodes", 0)))
    table.add_row("엣지", str(stats.get("edges", 0)))
    table.add_row("Dangling 노드", str(stats.get("dangling_nodes", 0)))
    table.add_row("연결 컴포넌트", str(stats.get("weakly_connected_components", 0)))
    table.add_row("밀도", f"{stats.get('density', 0):.6f}")

    console.print(table)

    # 엔티티 타입
    entity_types = stats.get("entity_types", {})
    if entity_types:
        et_table = Table(title="📦 엔티티 타입 분포")
        et_table.add_column("타입", style="green")
        et_table.add_column("수", style="white", justify="right")
        for etype, count in entity_types.items():
            et_table.add_row(etype, str(count))
        console.print(et_table)

    # 엣지 타입
    edge_types = stats.get("edge_types", {})
    if edge_types:
        eg_table = Table(title="🔗 엣지 타입 분포")
        eg_table.add_column("타입", style="yellow")
        eg_table.add_column("수", style="white", justify="right")
        for etype, count in edge_types.items():
            eg_table.add_row(etype, str(count))
        console.print(eg_table)

    # Top 허브
    top_hubs = stats.get("top_hubs", [])
    if top_hubs:
        hub_table = Table(title="🏆 Top 10 허브 노드 (연결 수)")
        hub_table.add_column("노드", style="cyan")
        hub_table.add_column("연결", style="white", justify="right")
        for name, degree in top_hubs:
            hub_table.add_row(str(name), str(degree))
        console.print(hub_table)


if __name__ == "__main__":
    main()
