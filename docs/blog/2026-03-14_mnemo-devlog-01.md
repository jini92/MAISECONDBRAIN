---
title: "Building Mnemo in Public #1 — From Ontology Quality 70.0 to 95.4"
date: 2026-03-14
tags: [mnemo, maisecondbrain, ontology, knowledge-graph, obsidian, graphrag, devlog]
language: en
channel: substack
---

# Building Mnemo in Public #1 — From Ontology Quality 70.0 to 95.4

Mnemo is my personal knowledge graph and GraphRAG system for Obsidian.

I am building it in public for a simple reason: I do not want to separate contribution from monetization. If I share real progress, real design decisions, and real trade-offs, that creates trust. And trust eventually turns into distribution, users, product opportunities, and revenue.

This week was about making Mnemo more reliable as a knowledge system, not just more impressive as a demo.

## What shipped this week

I added three major improvements.

### 1) Ontology quality validation
I added a SHACL-style validation layer for Mnemo's note ontology.

Instead of assuming frontmatter is clean, Mnemo now checks for:
- missing required fields
- missing explicit types
- invalid enum values
- invalid date formats
- invalid URLs
- missing supporting context

The goal is simple: if the graph is going to drive retrieval and reasoning, metadata quality cannot be treated as optional.

### 2) Deterministic metadata normalization
I also added a deterministic normalization pass.

This is important because I do not want Mnemo to hallucinate structure into the vault. The normalizer only fills or rewrites metadata when confidence is high enough.

That includes cases like:
- type canonicalization
- missing type backfill
- event_date normalization
- source_type normalization
- tool category normalization
- status normalization
- confidence normalization
- URL extraction from body content when the signal is explicit

### 3) LINEAGE view
I implemented a proper LINEAGE feature across the backend API and the Obsidian plugin.

For Mnemo, LINEAGE does not mean generic graph connectivity. It means provenance, dependency, and outcome.

By policy, the lineage view includes only these relation types:
- source
- derived_from
- uses
- used_in
- applied_to
- decisions

And it intentionally excludes noisy edges like:
- wiki_link
- related
- supports
- contradicts
- alternatives
- participants
- organization
- tag_shared

That keeps the view narrow enough to be useful.

## Results

After the normalization pass, ontology quality improved from **70.0** to **95.4**.

A few numbers from the real vault run:
- passed nodes: **14 → 3346**
- warnings: **8187 → 679**
- errors: **7 → 7**

I also validated the implementation with backend tests and plugin builds.

## One design choice I care about

I made the resolver more conservative.

If a bare-name query is ambiguous, Mnemo should not guess. It should either return no result or ask the user to disambiguate. In the plugin, that now means a candidate picker UI instead of a silent wrong match.

I think this matters a lot for personal knowledge systems. A wrong resolution is often worse than no resolution because it quietly damages trust.

## Why this matters beyond one feature

A lot of knowledge tools look magical in screenshots and fall apart in daily use.

The hard part is not drawing a graph. The hard part is keeping semantics stable enough that the graph remains useful over time.

That is why I care about:
- deterministic normalization over clever guessing
- provenance over vague relatedness
- conservative resolution over aggressive fuzzy matching
- explicit ontology over accidental structure

## Contribution and monetization are not separate

My broader strategy is to keep shipping Mnemo in public.

Not because public devlogs are trendy, but because this is how I want to build:
- contribute useful ideas and tools first
- document the reasoning behind them
- build trust in public
- turn that trust into product adoption, plugin installs, consulting, and future paid layers

For me, contribution is not charity and monetization is not the opposite of contribution. The strongest products often come from the place where both reinforce each other.

## What is next

The next improvements I want to make are:
- better candidate disambiguation for ambiguous note names
- cleaner path alias resolution
- less confusing cached graph behavior
- FastAPI startup cleanup using lifespan handlers

If you are building in Obsidian, GraphRAG, or personal knowledge systems, I would love to compare notes.

GitHub: https://github.com/jini92/MAISECONDBRAIN
PyPI: https://pypi.org/project/mnemo-secondbrain/
