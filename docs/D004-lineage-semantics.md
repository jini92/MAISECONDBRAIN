# D004 - LINEAGE Semantics

**Status:** draft spec  
**Purpose:** define a lineage-specific view for Mnemo so `LINEAGE` means provenance/dependency/outcome, not generic graph connectivity.

---

## 1. What LINEAGE means in Mnemo

`LINEAGE` is a **directed semantic slice** of the knowledge graph.

It should answer only these questions:

- **Upstream**: Where did this note/entity come from? What informed it? What did it depend on?
- **Downstream**: What did this note/entity produce, influence, or get applied to?

So LINEAGE is **not**:

- another name for full graph view,
- generic `related` browsing,
- tag/community similarity,
- plain `[[wiki_link]]` traversal.

A node/edge belongs in LINEAGE only when it expresses one of these meanings:

1. **provenance** — origin, citation, derivation,
2. **dependency** — an input required by something else,
3. **realization** — an output, decision, or application that came out of something.

---

## 2. Canonical lineage direction

The raw graph currently stores YAML relations as `owner -> target`.
That is fine for storage, but LINEAGE should normalize them into a **canonical direction**:

> **canonical lineage edge = upstream -> downstream**

This keeps traversal rules simple:

- **incoming lineage edges** = upstream
- **outgoing lineage edges** = downstream

### 2.1 Relation mapping

| relation type | raw graph direction | canonical lineage direction | lineage meaning | include? |
|---|---|---|---|---|
| `source` | owner -> target | `target -> owner` | direct provenance / citation | yes |
| `derived_from` | owner -> target | `target -> owner` | conceptual derivation / ancestor | yes |
| `uses` | owner -> target | `target -> owner` | dependency/input -> consumer | yes |
| `used_in` | owner -> target | `owner -> target` | tool/concept -> realizing project | yes |
| `applied_to` | owner -> target | `owner -> target` | idea/insight -> application target | yes |
| `decisions` | owner -> target | `owner -> target` | event/process -> produced decision | yes |
| `wiki_link` | source -> target | none | generic document link only | no |
| `related` | owner -> target | none | associative, not directional lineage | no |
| `supports` | owner -> target | none | argumentative evidence, not lineage | no |
| `contradicts` | owner -> target | none | tension/conflict, not lineage | no |
| `alternatives` | owner -> target | none | substitute relation, not lineage | no |
| `participants` | owner -> target | none | actor/context, not artifact lineage | no |
| `organization` | owner -> target | none | affiliation, not lineage | no |
| `tag_shared` | auto edge | none | similarity/noise edge | never |

### 2.2 Why `supports` is excluded

`supports` can be useful for reasoning, but it answers **"what strengthens this claim?"**, not **"what did this come from / what did it produce?"**.
That makes it graph context, not lineage.

---

## 3. Upstream / downstream semantics by included relation

Use the **canonical direction**, not the stored arrow, when labeling LINEAGE.

| relation type | upstream side | downstream side | UI label suggestion |
|---|---|---|---|
| `source` | cited source / original note | note that cites or extracts from it | `source` |
| `derived_from` | conceptual ancestor | derived note / concept / decision | `derived into` |
| `uses` | dependency, tool, prerequisite concept | consumer project/tool/concept | `used by` |
| `used_in` | reusable tool/concept | project that realizes it | `used in` |
| `applied_to` | insight/concept being applied | project/concept receiving application | `applied to` |
| `decisions` | event/process that generated the choice | resulting decision note | `decided` |

Implementation rule:

- If the focused node is on the **incoming** side of the canonical edge, mark the other node as `upstream`.
- If the focused node is on the **outgoing** side of the canonical edge, mark the other node as `downstream`.
- If a node appears on both sides within the same lineage slice, mark it as `bridge`.

---

## 4. `lineage_role` recommendation

Mnemo already uses **entity type** colors in graph rendering.  
So `lineage_role` should be shown as an **outline / halo / badge**, not by replacing the node fill color.

### 4.1 Recommended node roles

| lineage_role | meaning | label | color |
|---|---|---|---|
| `focus` | currently selected node | Current | `#06B6D4` |
| `upstream` | origin / ancestor / dependency feeding the focus | Upstream | `#2563EB` |
| `downstream` | outcome / application / consumer produced from the focus | Downstream | `#F59E0B` |
| `bridge` | lies on both upstream and downstream paths | Bridge | `#7C3AED` |
| `unresolved` | dangling or unknown lineage target | Unresolved | `#94A3B8` |

### 4.2 Legend copy

- **Current** — currently centered lineage node
- **Upstream** — where this came from / what it depends on
- **Downstream** — what this led to / where it was applied
- **Bridge** — intermediary in the lineage chain
- **Unresolved** — referenced lineage node not yet resolved to a typed note

### 4.3 Edge styling recommendation

- included lineage edges: solid
- excluded/generic edges: not rendered in LINEAGE mode
- unresolved lineage edges: dashed with `unresolved` color
- optional arrowheads should follow **canonical lineage direction** only

---

## 5. Edge inclusion / exclusion policy

### 5.1 Include

Only edges whose type is in this allowlist:

```text
source, derived_from, uses, used_in, applied_to, decisions
```

### 5.2 Exclude

Always exclude these from LINEAGE:

```text
wiki_link, related, supports, contradicts, alternatives, participants, organization, tag_shared
```

### 5.3 Important rules

1. **Do not infer lineage from node type alone.** A `source` entity is not lineage unless a lineage relation exists.
2. **Do not include plain wikilinks.** A wikilink may mean mention/navigation, not provenance.
3. **Always exclude `tag_shared`.** It is graph-density glue, not lineage.
4. **Prefer explicit relation semantics over auto-neighbor expansion.**
5. If the same node pair has multiple lineage relations, keep one rendered edge with:
   - `relation_types: [...]` in metadata,
   - a primary label priority of `derived_from > source > applied_to > used_in > uses > decisions`.

---

## 6. Examples with current Mnemo ontology entities

### Example A — provenance -> application chain

Using entities already shown in the ontology docs:

```text
YouTube_평범한사업가_74 (source)
  --source-->
옵시디언이 개인용 최적 RAG (insight)
  --applied_to-->
MAISECONDBRAIN (project)
```

Canonical lineage view:

```text
YouTube_평범한사업가_74 -> 옵시디언이 개인용 최적 RAG -> MAISECONDBRAIN
```

- `YouTube_평범한사업가_74` = upstream
- `옵시디언이 개인용 최적 RAG` = bridge
- `MAISECONDBRAIN` = downstream

### Example B — dependency lineage

```text
Python (tool) --used_in--> MAISECONDBRAIN (project)
NetworkX (tool) --used_in--> MAISECONDBRAIN (project)
Obsidian (tool) --used_in--> MAISECONDBRAIN (project)
```

These are valid lineage edges because they describe **what the project depends on to exist**.
In a MAISECONDBRAIN-focused lineage view, those tools are `upstream`.

### Example C — event -> decision

```text
주간 리뷰 (event) --decisions--> Neo4j 대신 NetworkX 사용 결정 (decision)
```

Canonical lineage:

```text
주간 리뷰 -> Neo4j 대신 NetworkX 사용 결정
```

The event is upstream; the decision note is downstream.

### Example D — graph edge that must stay out

```text
GraphRAG --tag_shared--> 온톨로지
GraphRAG --related--> 벡터 검색
```

These may be useful in full graph mode, but they are **not LINEAGE**.
They express similarity or association, not origin/dependency/outcome.

---

## 7. Practical implementation intent

If/when LINEAGE mode is implemented, it should behave like a **derived subgraph**:

1. start from the current graph,
2. filter to the lineage allowlist,
3. canonicalize every surviving edge to `upstream -> downstream`,
4. assign `lineage_role` relative to the focused node,
5. render only that canonical lineage slice.

If this mode shows the same shape as the normal graph, the implementation is wrong.

---

## 8. One-line definition for product/UI

> **LINEAGE shows where a note came from, what it depended on, and what it led to.**
