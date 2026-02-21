# T009: Graph Quality Improvement

**Date:** 2026-02-21
**Status:** Complete

## Goal
- Reduce graph components from 342 to <200
- Reduce unknown-type nodes from 259 to <100

## Results

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Components | 342 | **1** | <200 ✅ |
| Unknown nodes | 259 | **0** | <100 ✅ |
| Nodes | 3,480 | 3,355 | — |
| Edges | 35,993 | 36,197 | — |
| Density | 0.003 | 0.00322 | — |

## Entity Type Distribution (After)
| Type | Count |
|------|-------|
| event | 1,481 |
| project | 882 |
| note | 880 |
| source | 108 |
| insight | 2 |
| decision | 2 |

## Strategies Applied

### Component Reduction (`scripts/reduce_components.py`)

1. **Strategy D: Garbage node removal** — Removed 125 dangling nodes (images, code fragments, mermaid diagram labels)
2. **Strategy A: Tag bridge** — Connected 207 isolated nodes to main component via shared tags (min 2 tags shared)
3. **Strategy B: Folder bridge** — Connected 233 remaining isolated nodes to same-folder nodes in main component
4. **Strategy C: Small component merge** — Merged small (2-10 node) components via tag overlap

### Unknown Classification (`scripts/classify_unknown.py`)

134 remaining dangling nodes (after garbage removal) classified:
- note: 97
- project: 26
- source: 6
- event: 5

Classification rules: date patterns → event, file extensions → source, folder hints, keyword matching, default → note.

## Integration

Added as step [5.1] in `scripts/daily_enrich.py` — runs automatically after graph build, before stub generation.

## Files Changed
- `scripts/reduce_components.py` — new
- `scripts/classify_unknown.py` — new
- `scripts/daily_enrich.py` — added step 5.1
- `docs/T009-graph-quality-improvement.md` — this file
