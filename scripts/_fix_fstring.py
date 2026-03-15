"""Fix backslash-escaped quotes in f-string expressions for Python 3.12+."""
import pathlib, re

p = pathlib.Path(__file__).parent / "daily_enrich.py"
txt = p.read_text(encoding="utf-8")

# In f-string {} expressions, \' is invalid in Python 3.12+.
# Replace all occurrences of \' inside f-string curly braces with '
# Strategy: replace the specific known patterns
replacements = [
    (r"s[\'nodes\']", "s['nodes']"),
    (r"s[\'edges\']", "s['edges']"),
    (r"s.get(\'weakly_connected_components\', \'?\')", "s.get('weakly_connected_components', '?')"),
    (r"s.get(\'dangling_nodes\', \'?\')", "s.get('dangling_nodes', '?')"),
    (r"s.get(\'density\', 0)", "s.get('density', 0)"),
]

for old, new in replacements:
    txt = txt.replace(old, new)

p.write_text(txt, encoding="utf-8")
print("Fixed f-string escaping in daily_enrich.py")
