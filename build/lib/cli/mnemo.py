#!/usr/bin/env python3
"""mnemo CLI -- Click-based wrapper for MAISECONDBRAIN scripts.

Auto-loads environment variables so no manual setup is needed.
Install:
    pip install -e "C:\\TEST\\MAISECONDBRAIN"

Usage:
    mnemo search "베트남 시장" --top-k 7 --json
    mnemo search "BTC 전략" --graphrag
    mnemo enrich
    mnemo opportunities --json
    mnemo status
"""
import json as _json
import os
import subprocess
import sys
from pathlib import Path

import click

_PROJECT_ROOT = Path(__file__).resolve().parent.parent  # C:\TEST\MAISECONDBRAIN

# Default env values (can be overridden by actual env vars before calling)
VAULT_PATH = os.environ.get(
    "MNEMO_VAULT_PATH",
    r"C:\Users\jini9\OneDrive\Documents\JINI_SYNC",
)
MEMORY_PATH = os.environ.get("MNEMO_MEMORY_PATH", r"C:\MAIBOT\memory")
CACHE_DIR = os.environ.get("MNEMO_CACHE_DIR", str(_PROJECT_ROOT / ".mnemo"))


def setup_env() -> None:
    """Auto-set required environment variables with safe defaults."""
    os.environ.setdefault("MNEMO_VAULT_PATH", VAULT_PATH)
    os.environ.setdefault("MNEMO_MEMORY_PATH", MEMORY_PATH)
    os.environ.setdefault("MNEMO_CACHE_DIR", CACHE_DIR)
    os.environ.setdefault("MNEMO_USE_RERANKER", "true")
    os.environ.setdefault("MNEMO_EMBED_MODEL", "qwen3-embedding:0.6b")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")


def _run(script: Path, args: list) -> subprocess.CompletedProcess:
    """Run a Python script with the full project environment.
    
    Output streams directly to caller's stdout/stderr (no capture),
    so it works for both terminal use and piped agent output.
    """
    env = {**os.environ}
    env.setdefault("PYTHONPATH", str(_PROJECT_ROOT / "src"))
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, str(script)] + [str(a) for a in args],
        cwd=str(_PROJECT_ROOT),
        env=env,
    )


# ---------------------------------------------------------------------------
# CLI group
# ---------------------------------------------------------------------------

@click.group()
@click.version_option("1.1.0", prog_name="mnemo")
def cli():
    """Mnemo -- GraphRAG-powered second brain (env auto-loaded).

    All commands auto-load MNEMO_VAULT_PATH, MNEMO_MEMORY_PATH, etc.
    No manual env setup required.
    """


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------

@cli.command()
@click.argument("query")
@click.option("--top-k", default=7, type=int, show_default=True,
              help="Number of results to return")
@click.option("--graphrag", is_flag=True,
              help="Use GraphRAG LLM synthesis mode (slower, richer answer)")
@click.option("--dynamic-weights", is_flag=True,
              help="Adjust keyword/vector/graph weights by query type")
@click.option("--json", "json_mode", is_flag=True,
              help="Output as JSON (default: text)")
def search(query: str, top_k: int, graphrag: bool, dynamic_weights: bool, json_mode: bool):
    """Search vault + memory via hybrid vector/graph search.

    \b
    Examples:
        mnemo search "베트남 시장" --top-k 7 --json
        mnemo search "BTC 모멘텀 전략" --graphrag
        mnemo search "AI 수익화" --dynamic-weights

    Equivalent to:
        python scripts/integrated_search.py "query" --top-k 7 --format json
    """
    setup_env()
    script = _PROJECT_ROOT / "scripts" / "integrated_search.py"

    args = [query, "--top-k", top_k]
    if graphrag:
        args.append("--graphrag")
    if dynamic_weights:
        args.append("--dynamic-weights")
    args += ["--format", "json" if json_mode else "text"]

    result = _run(script, args)
    sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# enrich
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--quiet", "-q", is_flag=True, help="Suppress verbose pipeline output")
def enrich(quiet: bool):
    """Run daily vault enrichment pipeline (daily_enrich.py).

    \b
    Pipeline stages:
      1. Parse vault + memory files
      2. Enrich type + project frontmatter
      3. Enrich related links
      4. Enrich content tags + backlinks
      5. Rebuild knowledge graph
      6. Generate stub notes for dangling refs
      7. Update embeddings (incremental)
      8. Collect external knowledge
      9. Scan opportunities
     10. Update Obsidian dashboard

    Runtime: ~90-120 seconds for 3,500+ notes.
    """
    setup_env()
    script = _PROJECT_ROOT / "scripts" / "daily_enrich.py"

    if not quiet:
        click.echo(click.style("Starting Mnemo daily enrichment...", fg="cyan"), err=True)

    result = _run(script, [])
    sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# opportunities
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--top-k", default=10, type=int, show_default=True,
              help="Maximum opportunities to return")
@click.option("--days", default=7, type=int, show_default=True,
              help="Look-back window in days for external scan")
@click.option("--json", "json_mode", is_flag=True,
              help="Output as JSON")
def opportunities(top_k: int, days: int, json_mode: bool):
    """Scan knowledge graph for business/project opportunities.

    Equivalent to:
        python scripts/opportunity_scanner.py --top-k 10 --format json
    """
    setup_env()
    script = _PROJECT_ROOT / "scripts" / "opportunity_scanner.py"

    args = ["--top-k", top_k, "--days", days]
    if json_mode:
        args += ["--format", "json"]

    result = _run(script, args)
    sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# status
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--json", "json_mode", is_flag=True, help="Output as JSON")
def status(json_mode: bool):
    """Show vault statistics: file counts, cache, env config.

    Reads from filesystem only -- fast (no graph rebuild needed).
    """
    setup_env()

    vault_path = Path(os.environ.get("MNEMO_VAULT_PATH", ""))
    memory_path = Path(os.environ.get("MNEMO_MEMORY_PATH", ""))
    cache_dir = Path(os.environ.get("MNEMO_CACHE_DIR", str(_PROJECT_ROOT / ".mnemo")))

    md_files = list(vault_path.glob("**/*.md")) if vault_path.exists() else []
    mem_files = list(memory_path.glob("*.md")) if memory_path.exists() else []
    cache_files = list(cache_dir.glob("*.pkl")) if cache_dir.exists() else []

    data = {
        "vault_path": str(vault_path),
        "vault_files": len(md_files),
        "memory_path": str(memory_path),
        "memory_files": len(mem_files),
        "cache_dir": str(cache_dir),
        "cache_files": len(cache_files),
        "cache_pkl_names": [f.name for f in cache_files],
        "embed_model": os.environ.get("MNEMO_EMBED_MODEL", "qwen3-embedding:0.6b"),
        "reranker": os.environ.get("MNEMO_USE_RERANKER", "true") == "true",
    }

    if json_mode:
        click.echo(_json.dumps(data, ensure_ascii=False, indent=2))
    else:
        click.echo(f"Vault    : {vault_path} ({len(md_files)} files)")
        click.echo(f"Memory   : {memory_path} ({len(mem_files)} files)")
        click.echo(f"Cache    : {cache_dir} ({len(cache_files)} pkl files)")
        click.echo(f"Model    : {data['embed_model']}")
        click.echo(f"Reranker : {data['reranker']}")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cli()
