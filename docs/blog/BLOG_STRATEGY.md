# MAISECONDBRAIN Blog Operating Rules

Last updated: 2026-03-14

## Goal

Position MAISECONDBRAIN (Mnemo) as a build-in-public knowledge graph / Obsidian / GraphRAG project,
while keeping it clearly separate from M.AI.UPbit inside the same publication.

## Publication Strategy

- Keep the current Substack publication for now.
- Separate MAISECONDBRAIN from M.AI.UPbit by:
  - series naming
  - title prefixes
  - tag discipline
  - audience positioning
  - opening/closing copy

## Audience Positioning

### M.AI.UPbit
- Quant
- crypto market analysis
- signals / allocation / portfolio logic
- investor-oriented letter

### MAISECONDBRAIN
- Mnemo
- personal knowledge systems
- Obsidian power users
- knowledge graph / GraphRAG builders
- AI tool builders
- build-in-public developer audience

## Series Structure

Use these series buckets for MAISECONDBRAIN posts.

1. **Building Mnemo in Public**
   - Primary devlog series
   - For milestones, implementation work, architecture changes, progress updates

2. **Mnemo Architecture Notes**
   - For deeper technical writeups
   - Ontology, retrieval, graph semantics, ranking, data model, API design

3. **Mnemo Experiments**
   - For evaluation, benchmark, failed ideas, A/B tests, prompt/system changes

## Default Title Rules

### Devlog
`Building Mnemo in Public #N — <specific result>`

Examples:
- Building Mnemo in Public #2 — Making lineage useful instead of noisy
- Building Mnemo in Public #3 — Turning vault metadata into graph edges

### Architecture
`Mnemo Architecture Notes #N — <technical topic>`

Examples:
- Mnemo Architecture Notes #1 — Why lineage should exclude generic related edges
- Mnemo Architecture Notes #2 — Hybrid retrieval without semantic soup

### Experiment
`Mnemo Experiments #N — <experiment name>`

Examples:
- Mnemo Experiments #1 — Reranker on vs off in vault search
- Mnemo Experiments #2 — Graph hops vs precision tradeoff

## Tag Rules

### Core tags (pick 3-5)
- mnemo
- maisecondbrain
- knowledge-graph
- graphrag
- obsidian
- build-in-public

### Topic tags (pick 1-3)
- ontology
- lineage
- retrieval
- reranking
- embeddings
- developer-tools
- personal-knowledge-management
- second-brain

### Rule
- Always include: `mnemo`
- Usually include: `maisecondbrain`
- Do not mix in trading/investment/crypto tags used by M.AI.UPbit
- Keep total tags to about 5-8

## Subtitle Formula

Use a technical subtitle that signals scope quickly.

Formula:
`<three concrete technical themes>`

Example:
`Deterministic metadata normalization, lineage graphs, and contribution-first monetization`

## Opening Paragraph Pattern

1. State the concrete change
2. Explain why it matters for users/builders
3. Connect it to the larger Mnemo / MAI Universe direction

## Closing Paragraph Pattern

Use one of these endings:

- What I learned
- What breaks next
- What I will build next
- Why this matters beyond Mnemo

## Positioning Guardrails

Do:
- sound like a builder sharing real progress
- connect implementation details to product direction
- tie posts back to contribution + monetization philosophy when relevant

Do not:
- sound like a market letter
- mix price/action/trading framing into Mnemo posts
- publish generic AI trend content without a concrete Mnemo angle

## Frontmatter Template

```yaml
---
title: "Building Mnemo in Public #N — <result>"
date: YYYY-MM-DD
tags: [mnemo, maisecondbrain, knowledge-graph, obsidian, build-in-public]
language: en
channel: substack
series: building-mnemo-in-public
project: MAISECONDBRAIN
---
```

## Recommended Next Posts

1. Building Mnemo in Public #2 — Making lineage useful instead of noisy
2. Mnemo Architecture Notes #1 — Why ontology quality matters more than graph size
3. Mnemo Experiments #1 — Hybrid search weights in real vault retrieval
