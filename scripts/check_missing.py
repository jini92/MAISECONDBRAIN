import pickle, sys
sys.stdout.reconfigure(encoding='utf-8')
with open('.mnemo/graph.pkl','rb') as f:
    import networkx as nx
    G = pickle.load(f)

missing = [(n,d) for n,d in G.nodes(data=True) if 'entity_type' not in d]
print(f'Missing entity_type: {len(missing)}')
for n,d in missing[:20]:
    p = d.get('path', 'NO PATH')
    print(f'  {n} | has_path={bool(p != "NO PATH")} | keys={list(d.keys())[:5]}')

# Check if these are dangling references (no file)
has_path = sum(1 for _,d in missing if 'path' in d)
no_path = len(missing) - has_path
print(f'\nWith path: {has_path}, Without path (dangling refs): {no_path}')

# Sample those with path
print('\n=== With path (sample) ===')
count = 0
for n,d in missing:
    if 'path' in d and count < 10:
        print(f'  {n}')
        count += 1

print('\n=== Without path (sample) ===')
count = 0
for n,d in missing:
    if 'path' not in d and count < 10:
        print(f'  {n} | attrs={dict(d)}')
        count += 1
