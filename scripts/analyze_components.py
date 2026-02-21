"""Analyze graph components and unknown entities."""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

# Load graph
import networkx as nx
import pickle
with open('.mnemo/graph.pkl', 'rb') as f:
    G = pickle.load(f)

# Component analysis
components = list(nx.weakly_connected_components(G))
sizes = sorted([len(c) for c in components], reverse=True)

print("=== Component Size Distribution ===")
buckets = {1:0, 2:0, '3-5':0, '6-10':0, '11-50':0, '51-100':0, '100+':0}
for s in sizes:
    if s == 1: buckets[1] += 1
    elif s == 2: buckets[2] += 1
    elif s <= 5: buckets['3-5'] += 1
    elif s <= 10: buckets['6-10'] += 1
    elif s <= 50: buckets['11-50'] += 1
    elif s <= 100: buckets['51-100'] += 1
    else: buckets['100+'] += 1
for k,v in buckets.items():
    print(f"  size={k}: {v} components")

print(f"\nTotal components: {len(components)}")
print(f"Largest: {sizes[0]}, Top 5: {sizes[:5]}")

# Large components (10+ nodes)
print("\n=== Components with 10+ nodes ===")
for c in components:
    if len(c) >= 10:
        sample = list(c)[:5]
        print(f"  [{len(c)} nodes] sample: {sample}")

# Small isolated components (size 1-2) samples
print("\n=== Sample isolated nodes (size=1) ===")
for c in components:
    if len(c) == 1:
        node = list(c)[0]
        print(f"  {node} | type={G.nodes[node].get('entity_type','?')}")
small_count = 0
print("\n=== Sample size=2 components ===")
for c in components:
    if len(c) == 2 and small_count < 10:
        nodes = list(c)
        print(f"  {nodes}")
        small_count += 1

# Unknown entities (non-dangling)
print("\n=== Unknown entities (non-dangling, sample 20) ===")
count = 0
for n, d in G.nodes(data=True):
    if d.get('entity_type') == 'unknown' and G.degree(n) > 0:
        if count < 20:
            print(f"  {n} | degree={G.degree(n)}")
            count += 1
print(f"Total unknown with edges: {count}+ (showing 20)")
