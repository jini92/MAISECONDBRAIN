"""留ㅼ씪 ?먮룞 蹂쇳듃 蹂닿컯 ?뚯씠?꾨씪??"""
import sys
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8")
sys.path.insert(0, "src")

import time

VAULT = os.environ.get("MNEMO_VAULT_PATH")
if not VAULT:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
MEMORY = os.environ.get("MNEMO_MEMORY_PATH")
if not MEMORY:
    print("ERROR: MNEMO_MEMORY_PATH environment variable is not set."); sys.exit(1)
from pathlib import Path
CACHE_DIR = str(Path(__file__).resolve().parent.parent / ".mnemo")

print("=" * 50)
print("?쭬 Mnemo Daily Enrichment Pipeline")
print("=" * 50)

t_total = time.time()

# 1. Parse
print("\n[1/9] Parsing vault...")
from mnemo.parser import parse_vault
notes = parse_vault(VAULT)
memory_notes = parse_vault(MEMORY)
print(f"  {len(notes)} vault + {len(memory_notes)} memory notes")

# 2. Type + Project
print("\n[2/9] Enriching type + project...")
from mnemo.enricher import plan_enrichment, apply_enrichment
plans = plan_enrichment(notes, auto_related=False)
applied_struct = 0
for p in plans:
    try:
        r = apply_enrichment(p, dry_run=False)
        if r and "[APPLIED]" in r:
            applied_struct += 1
    except Exception:
        pass
print(f"  {applied_struct} notes updated")

# 3. Related
print("\n[3/9] Enriching related links...")
candidates = [n for n in notes if not n.frontmatter.get("related")]
plans_rel = plan_enrichment(candidates, auto_related=True)
related_plans = [p for p in plans_rel if p.add_related]
applied_rel = 0
for p in related_plans:
    p.add_type = None
    p.add_project = None
    try:
        r = apply_enrichment(p, dry_run=False)
        if r and "[APPLIED]" in r:
            applied_rel += 1
    except Exception:
        pass
print(f"  {applied_rel} notes updated")

# 4. Content tags + backlinks
print("\n[4/9] Enriching content tags + backlinks...")
from mnemo.content_linker import analyze_all, apply_content_enrichment
enrichments = analyze_all(notes)
applied_content = 0
for e in enrichments:
    try:
        r = apply_content_enrichment(e, dry_run=False)
        if r and "[OK]" in r:
            applied_content += 1
    except Exception:
        pass
print(f"  {applied_content} notes updated")

# 5. Graph rebuild
print("\n[5/9] Rebuilding graph...")
notes = parse_vault(VAULT)
notes.extend(memory_notes)
from mnemo.graph_builder import build_graph, graph_stats
from mnemo.cache import BuildCache
cache = BuildCache(CACHE_DIR)
G = build_graph(notes, include_tag_edges=True)
stats = graph_stats(G)
current_checksums = {n.name: n.checksum for n in notes}
cache.save_checksums(current_checksums)
cache.save_graph(G)
cache.save_stats(stats)
print(f"  {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

# 5.1. Graph quality improvement — reduce components + classify unknowns
print("\n[5.1] Improving graph quality...")
try:
    from reduce_components import reduce_components
    from classify_unknown import classify_unknowns
    reduce_result = reduce_components(G)
    classify_result = classify_unknowns(G)
    cache.save_graph(G)
    stats = graph_stats(G)
    cache.save_stats(stats)
    print(f"  Components: {reduce_result['before']['components']} -> {reduce_result['after']['components']}")
    print(f"  Unknown classified: {sum(classify_result.values())}")
except Exception as e:
    print(f"  Graph quality improvement error (skipped): {e}")

# 5.5. Generate stub notes for dangling references
print("\n[6/9] Generating stub notes for dangling references...")
try:
    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).parent))
    from generate_stubs import load_graph, find_dangling, is_image_ref, file_exists_in_vault, generate_stub_content
    import os as _os
    dangling_list = find_dangling(G, top_n=50)
    stub_dir = _os.path.join(str(VAULT), "03.RESOURCES", "\uc2a4\ud141")
    _os.makedirs(stub_dir, exist_ok=True)
    stub_created = 0
    for name, count, source_notes in dangling_list:
        if is_image_ref(name):
            continue
        if file_exists_in_vault(str(VAULT), name):
            continue
        safe_name = name
        for ch in '<>:"/\\|?*':
            safe_name = safe_name.replace(ch, '_')
        stub_path = _os.path.join(stub_dir, f"{safe_name}.md")
        content = generate_stub_content(name, source_notes)
        with open(stub_path, "w", encoding="utf-8") as f:
            f.write(content)
        stub_created += 1
    print(f"  {stub_created} stubs created")
except Exception as e:
    print(f"  Stub generation error (skipped): {e}")

# 6. Embeddings (incremental)
print("\n[7/9] Updating embeddings...")
from mnemo.embedder import embed_notes, EmbeddingCache
emb_cache = EmbeddingCache(CACHE_DIR)
existing = emb_cache.load()
try:
    embeddings = embed_notes(notes, provider="ollama", model="nomic-embed-text", existing=existing)
    emb_cache.save(embeddings)
    new_count = len(embeddings) - len(existing)
    print(f"  {len(embeddings)} total ({new_count} new)")
except Exception as e:
    print(f"  Embedding error (skipped): {e}")

# 7. External knowledge collection (YouTube, optional Brave)
print("\n[8/9] Collecting external knowledge...")
try:
    import os
    from mnemo.collectors.knowledge_pipeline import collect_all_projects, save_to_vault
    brave_key = os.environ.get("BRAVE_API_KEY", "")
    knowledge = collect_all_projects(brave_api_key=brave_key or None)
    saved = save_to_vault(knowledge, VAULT)
    print(f"  {len(saved)} new notes saved to 03.RESOURCES/?몃?吏??")
except Exception as e:
    print(f"  Collection error (skipped): {e}")

# 8. Dashboard sync (Obsidian)
print("\n[9/9] Syncing dashboards...")
try:
    from datetime import datetime
    import re as _re

    def _build_mnemo_block(s):
        """stats dict ??markdown block"""
        et = s.get("entity_types", {})
        edge_t = s.get("edge_types", {})
        hubs = s.get("top_hubs", [])[:4]
        pr = s.get("top_pagerank", [])
        # pick non-date top pagerank entries
        pr_names = [n for n, _ in pr if not n.startswith("20")][:3]

        hub_str = " 쨌 ".join(f"[[{n}]] ({d})" for n, d in hubs)
        pr_str = " 쨌 ".join(f"[[{n}]]" for n in pr_names)
        et_str = " 쨌 ".join(f"`{k}` {v:,}" for k, v in et.items())
        edge_str = " 쨌 ".join(f"`{k}` {v:,}" for k, v in edge_t.items())
        today = datetime.now().strftime("%Y-%m-%d")

        return (
            f"> **Last updated:** {today}\n"
            f"\n"
            f"| Metric | Value |\n"
            f"|--------|-------|\n"
            f"| **Nodes** | {s['nodes']:,} |\n"
            f"| **Edges** | {s['edges']:,} |\n"
            f"| **Connected Components** | {s.get('weakly_connected_components', '?')} |\n"
            f"| **Dangling Nodes** | {s.get('dangling_nodes', '?')} ??|\n"
            f"| **Density** | {s.get('density', 0):.4f} |\n"
            f"\n"
            f"**Entity Types:**\n"
            f"{et_str}\n"
            f"\n"
            f"**Edge Types:**\n"
            f"{edge_str}\n"
            f"\n"
            f"**Top Hubs:** {hub_str}\n"
            f"\n"
            f"**Top PageRank:** {pr_str}"
        )

    DASHBOARD_FILES = [
        Path(VAULT) / "01.PROJECT" / "_MASTER_DASHBOARD.md",
        Path(VAULT) / "TEMPLATES" / "Dashboard.md",
    ]
    MARKER_RE = _re.compile(
        r"(<!-- AUTO:mnemo-stats:START -->)\n.*?\n(<!-- AUTO:mnemo-stats:END -->)",
        _re.DOTALL,
    )
    block = _build_mnemo_block(stats)
    synced = 0
    for dp in DASHBOARD_FILES:
        if not dp.exists():
            continue
        text = dp.read_text(encoding="utf-8")
        new_text, n = MARKER_RE.subn(rf"\1\n{block}\n\2", text)
        if n > 0 and new_text != text:
            dp.write_text(new_text, encoding="utf-8")
            synced += 1
    print(f"  {synced} dashboard(s) updated")
except Exception as e:
    print(f"  Dashboard sync error (skipped): {e}")

# Summary
elapsed = time.time() - t_total
print(f"\n{'=' * 50}")
print(f"??Complete in {elapsed:.1f}s")
print(f"  struct: {applied_struct} | related: {applied_rel} | content: {applied_content}")
print(f"  graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"{'=' * 50}")

