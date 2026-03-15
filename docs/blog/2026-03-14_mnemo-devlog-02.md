---
title: "Building Mnemo in Public #2 - Making lineage useful instead of noisy"
date: 2026-03-14
tags: [mnemo, maisecondbrain, knowledge-graph, obsidian, build-in-public, lineage]
language: en
channel: substack
series: building-mnemo-in-public
project: MAISECONDBRAIN
---

# Building Mnemo in Public #2 - Making lineage useful instead of noisy

> Lineage edge filtering, conservative resolution, and candidate disambiguation for provenance that people can actually trust.

The second Mnemo devlog is about a problem I see in many graph-based knowledge tools.

They can show a lot of connections, but that does not automatically make them useful.

If every edge is allowed into the same view, the graph becomes visually impressive and semantically weak. You get density, not explanation. For Mnemo, I wanted LINEAGE to mean something much narrower and much more practical: where something came from, what it depended on, and what it led to.

That meant reducing noise on purpose.

## What changed

I shipped a more opinionated LINEAGE model across the backend and the Obsidian plugin.

This work had four parts:

1. I defined explicit lineage semantics instead of treating lineage as generic graph browsing.
2. I restricted the allowed edge types to provenance / dependency / outcome relations only.
3. I made name resolution more conservative so ambiguous lookups stop pretending to be correct.
4. I added candidate disambiguation so ambiguity becomes a visible workflow instead of a silent mistake.

## Why this matters

A lineage view should answer directional questions:

- Where did this note or entity come from?
- What informed it?
- What did it produce?
- Where was it applied?

It should not answer every graph question at once.

That is why LINEAGE in Mnemo is intentionally not:

- full graph mode,
- generic `related` browsing,
- tag similarity,
- plain wiki-link traversal.

I would rather have a smaller graph that explains causality than a larger graph that only suggests vague association.

## The semantic change

I added a dedicated lineage semantics spec so the implementation has a clear contract.

The core idea is simple:

> canonical lineage edge = upstream -> downstream

That lets the graph stay internally flexible while the lineage view stays predictable.

In practice, Mnemo now includes only these relation types in LINEAGE:

- `source`
- `derived_from`
- `uses`
- `used_in`
- `applied_to`
- `decisions`

And it intentionally excludes noisy or non-lineage relations such as:

- `related`
- `supports`
- `contradicts`
- `alternatives`
- `participants`
- `organization`
- `tag_shared`
- `wiki_link`

That is the difference between a provenance view and a graph that is just wearing a lineage label.

## Why I excluded generic relations

This is the opinionated part.

A relation like `supports` can absolutely be useful for reasoning. But it answers a different question. It says, "what strengthens this claim?" not "what did this come from?"

Likewise, `related` and `tag_shared` can be helpful in a broader exploration mode, but they add exactly the kind of graph density that makes lineage hard to read.

So I drew a line:

- full graph mode can stay broad,
- lineage mode has to stay narrow.

If both modes look the same, one of them is lying.

## UI changes in the plugin

I did not want the plugin to treat lineage as just another color variant of the graph.

So the plugin now makes the lineage role visible:

- current node as the focus,
- upstream nodes as inputs or ancestors,
- downstream nodes as outcomes or applications,
- bridge nodes as intermediaries in the chain.

I also updated the visual language so entity-type meaning and lineage-role meaning do not collapse into one another. The point is to help the graph answer a question, not just to look busy.

## Conservative resolution over fake certainty

One design decision I care about a lot: Mnemo should not guess aggressively when the lookup is ambiguous.

I tightened the bare-name resolver so weak fuzzy matches do not quietly win just because they are close enough. Exact semantic matches should be preferred, and weak contains-matching should not be treated like confidence.

This matters more in personal knowledge systems than people sometimes admit.

A wrong answer that looks confident is worse than an explicit ambiguity, because it damages trust invisibly.

## Candidate disambiguation

Once I made the resolver stricter, I needed a better behavior than just "not found."

So I added candidate disambiguation to the lineage flow.

Now, if a lineage lookup is ambiguous, Mnemo can return a structured ambiguous result with candidate metadata such as:

- id
- name
- path
- entity type
- match kind
- score

And in the plugin, that ambiguity opens into a picker workflow instead of silently choosing the wrong node.

This is one of those features that does not look flashy in a screenshot, but it is exactly the kind of thing that makes a system feel dependable in real use.

## What shipped technically

This lineage pass included:

- a dedicated lineage semantics spec,
- backend lineage policy alignment,
- stricter ambiguity handling in the API,
- candidate ranking + candidate list generation,
- an Obsidian picker UI for ambiguous lineage selection,
- graph legend and role presentation cleanup.

I also validated the changes with backend tests and plugin build checks while iterating on the semantics.

## The bigger lesson

A lot of AI and knowledge tools try to win by expanding scope.

More edges. More similarity. More retrieval. More graph.

But I think product trust often comes from the opposite move: deciding what a view should *not* mean.

For Mnemo, LINEAGE only becomes useful when it stops trying to be a universal graph mode.

Narrowing the semantics made the feature better.

Not because smaller is always better, but because clarity compounds.

## Why this matters for Mnemo

Mnemo is not supposed to be a graph demo. It is supposed to help me and other builders understand:

- provenance,
- transformation,
- dependency,
- application,
- and decision flow

across real notes, projects, events, tools, and ideas.

That means every visual mode needs a contract.

If a graph feature cannot explain what it is showing and why those edges belong there, it is not ready.

## What comes next

The next things I want to improve are:

- stronger lineage-aware retrieval surfaces,
- better unresolved-node handling,
- more explicit user-facing explanation of why an edge is included,
- tighter connection between lineage debugging and product workflows.

I think this is the right direction for Mnemo.

Not a graph that shows everything.
A graph that explains how things become other things.

GitHub: https://github.com/jini92/MAISECONDBRAIN
PyPI: https://pypi.org/project/mnemo-secondbrain/
