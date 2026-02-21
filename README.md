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

### Installation

```bash
# Core (graph + CLI)
pip install mnemo-secondbrain

# With API server
pip install mnemo-secondbrain[api]

# With sentence-transformers embeddings
pip install mnemo-secondbrain[sbert]

# Everything
pip install mnemo-secondbrain[all]
```

### Configuration

Create a `config.yaml` (see `config.example.yaml`):

```yaml
vault_path: ~/Documents/MyVault
embedding:
  provider: sbert          # or "openai", "ollama"
  model: all-MiniLM-L6-v2
```

Or use environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MNEMO_VAULT_PATH` | Path to your Obsidian vault | `~/Documents/MyVault` |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI embeddings) | `sk-...` |

### CLI Usage

```bash
# Build the knowledge graph from your vault
mnemo build

# Search your knowledge graph
mnemo search "machine learning fundamentals"

# Show graph statistics
mnemo stats

# Export graph
mnemo export --format graphml
```

### API Server

```bash
# Start the API server (requires mnemo-secondbrain[api])
mnemo serve --host 0.0.0.0 --port 8000
```

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search` | Hybrid search |
| `GET` | `/api/graph/stats` | Graph statistics |
| `GET` | `/api/graph/node/{id}` | Get node details |
| `GET` | `/api/graph/neighbors/{id}` | Get node neighbors |

### Obsidian Plugin

The companion Obsidian plugin lives in `obsidian-plugin/`. See its README for installation instructions. It connects to the Mnemo API server for in-vault search and graph visualization.

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
