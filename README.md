# Mnemo — Personal Knowledge Graph for Obsidian

[![PyPI version](https://badge.fury.io/py/mnemo-secondbrain.svg)](https://pypi.org/project/mnemo-secondbrain/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

> Turn your Obsidian vault into a queryable knowledge graph with hybrid search (vector + graph traversal).

## Features

- **Automatic Graph Building** — Parses `[[wikilinks]]`, YAML frontmatter, and tags from your Obsidian vault into a NetworkX knowledge graph
- **Hybrid Search** — Combines vector similarity search with graph-based multi-hop traversal
- **Ontology Classification** — Auto-classifies entities (Person, Concept, Project, Tool, Insight, etc.)
- **Knowledge Collectors** — Web clipping, trust evaluation, and automated knowledge pipeline
- **REST API** — FastAPI server for programmatic access
- **Obsidian Plugin** — Companion plugin for in-vault queries (see `obsidian-plugin/`)
- **CLI Interface** — Full-featured command-line tool for graph operations

## Quick Start

### Option 1 — uvx (recommended, no install needed)

```bash
uvx --from mnemo-secondbrain mnemo start /path/to/your/vault
```

That's it. One command builds your knowledge graph and starts the API server.

### Option 2 — pip

```bash
pip install mnemo-secondbrain
mnemo start /path/to/your/vault
```

### Option 3 — Docker

```bash
docker run -p 7890:7890 -v /path/to/your/vault:/vault jini92/mnemo /vault
```

### Connect Obsidian Plugin

1. Open Obsidian → **Settings** → **Community plugins** → search **Mnemo SecondBrain** → Install & Enable
2. In the Mnemo plugin settings, set **Server URL** to `http://localhost:7890`
3. Press `Ctrl+Shift+M` to search your knowledge graph

---

### Advanced Usage

```bash
# Build graph only (no server)
mnemo build /path/to/your/vault

# Start server only (after building)
mnemo serve --port 7890

# Query from CLI
mnemo query "machine learning fundamentals"

# Show graph statistics
mnemo stats
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search` | Hybrid search |
| `GET` | `/api/graph/stats` | Graph statistics |
| `GET` | `/api/graph/node/{id}` | Get node details |
| `GET` | `/api/graph/neighbors/{id}` | Get node neighbors |

## Architecture

```
Obsidian Vault (Markdown + YAML + [[links]])
        ↓  parse
   NetworkX Graph (in-memory)
        ↓  embed
   Vector Index + Graph Index
        ↓  query
   Hybrid Search (vector + graph traversal)
        ↓  rerank
   Results with context
```

## Development

```bash
git clone https://github.com/jini92/MAISECONDBRAIN.git
cd MAISECONDBRAIN
pip install -e ".[dev,all]"
pytest
```

## License

MIT — see [LICENSE](LICENSE).
