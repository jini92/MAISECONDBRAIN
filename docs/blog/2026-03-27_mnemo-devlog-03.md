---
title: "Building Mnemo in Public #3 - Why I split memory into an operational layer and a reasoning layer"
date: 2026-03-27
tags: [mnemo, maisecondbrain, knowledge-graph, graphrag, obsidian, build-in-public, memory]
language: en
channel: substack
series: building-mnemo-in-public
project: MAISECONDBRAIN
---

# Building Mnemo in Public #3 - Why I split memory into an operational layer and a reasoning layer

> This week I stopped treating memory like one giant bucket. MAIJINI now uses a small operational memory for action-changing facts and Mnemo as the deeper reasoning layer for long context, relationships, and cross-project recall.

A lot of AI assistants fail in a boring way.

They do not fail because the model is weak.
They fail because memory becomes messy.

One layer gets overloaded with everything:

- preferences
- temporary status
- meeting notes
- research fragments
- experimental logs
- relationship context
- half-finished ideas

That looks comprehensive, but it quietly makes the system worse.
The assistant becomes slower to retrieve the right thing, more likely to surface stale details, and less clear about what should actually change behavior right now.

This week I finally made the split explicit.

## The decision

MAIJINI now uses two different memory layers on purpose.

### 1. Operational memory

This is the short, action-changing layer.

It stores things like:

- preferences
- durable decisions
- current state
- next actions
- access paths
- operating rules

In practice, this is the `memory/*.md` layer.

It is intentionally small.
If a note does not change how the assistant should operate, it probably does not belong here.

### 2. Reasoning memory

This is the deep context layer.

It stores things like:

- long experiment history
- meeting context
- cross-project relationships
- background research
- document-level source material
- knowledge that needs synthesis, not just lookup

For me, that layer is Mnemo.
Mnemo sits on top of Obsidian and turns the vault into a knowledge graph plus GraphRAG retrieval system.

That means I can ask for something more structural, like:

- why a decision was made
- what another project learned from a similar failure
- which ideas connect across multiple initiatives
- where a concept appeared before and what it influenced

That is not the same job as a tiny operational memory.
And trying to make one store do both jobs is how systems get noisy.

## The retrieval order changed too

The more important part was not only storage.
It was retrieval policy.

The default recall flow is now:

`memory_search -> Mnemo -> web_search`

That order matters.

### Start with the small layer first

When a question is really about preference, status, or a previously made decision, the right answer is often already in the operational layer.
That is the fastest and safest place to check.

### Go deeper only when confidence is still low

If that is not enough, Mnemo becomes the second step.
That is where deeper reasoning happens:

- graph relationships
- long-tail notes
- historical context
- cross-project inference
- source-backed synthesis

### Search the web last

External search is still useful.
But it should come after internal knowledge.
If the answer already exists inside the system, I do not want the assistant acting like it forgot its own work.

## Why this mattered now

This was not a theoretical cleanup.
It came from real operator pain.

Over the last few days, two things became obvious.

First, some information needed to stay tiny and durable.
For example:

- publishing cadence
- project priority order
- channel rules
- memory policy itself
- what counts as a real completion condition

Second, some answers clearly needed a richer layer.
The moment the question becomes:

- what changed across multiple projects
- why a trade-off was chosen
- what patterns repeat across experiments
- where a past design idea came from

short operational notes are not enough.
That is Mnemo territory.

I do not want the agent to pretend those are the same kind of recall.
They are not.

## A related fix: stable runtime beats clever architecture

This week also surfaced another boring but important lesson.
A lot of memory confusion was not actually “AI” confusion.
It was systems confusion.

Mnemo looked unhealthy from one angle because an older mental model still expected `localhost:7890`, while the live FastAPI service was already running on `127.0.0.1:8000`.

That sounds small, but it matters.
If your runtime surface and your operator assumptions drift apart, the memory layer looks unreliable even when the core system is fine.

So part of this week was not inventing a new feature.
It was restoring trust:

- confirm the live server path
- verify the retrieval route
- tune GraphRAG defaults for the actual Windows CPU environment
- stop confusing old assumptions with current reality

I like architecture. But in practice, stable operators trust verified behavior more than pretty diagrams.

## The design principle underneath

I increasingly think agent memory should follow the same rule as software storage systems:

**hot state and deep history should not be treated as the same class of data.**

Operational memory is hot state.
It should be:

- short
- explicit
- behavior-changing
- easy to update
- easy to trust

Reasoning memory is deep history.
It should be:

- broad
- relational
- source-backed
- synthesizable
- allowed to stay large

If you mix them without a policy, the agent starts carrying a backpack full of everything and reaching for the wrong item at the wrong time.

## What this unlocks

This split is small, but I think it compounds.

It makes the assistant better at:

- answering directly when the answer is already decided
- escalating to deeper recall only when needed
- keeping memory files clean enough to stay operational
- using Mnemo for actual reasoning instead of as a dumping ground
- recovering decision history without polluting the fast path

And it makes build-in-public easier too.
Because now I can describe the system more honestly:

- `memory/*.md` is the operating memory
- Mnemo is the reasoning memory
- web search is the external fallback

That is a cleaner product story than "there is one giant memory and it somehow does everything."

## What I want to keep improving

The next steps are not glamorous, but they matter:

- keep shrinking operational memory to decision-grade notes only
- move long context and relationship-heavy material into Mnemo or Obsidian
- keep runtime defaults aligned with actual deployment paths
- make the retrieval boundaries more visible to the operator

Good memory systems are not impressive because they store everything.
They are impressive because they know what should stay small, what should stay deep, and when to cross that boundary.

That is what I am trying to build with Mnemo.

GitHub: https://github.com/jini92/MAISECONDBRAIN
PyPI: https://pypi.org/project/mnemo-secondbrain/

