"""Mnemo Nightly Ingest — OneDrive multi-format batch ingestion.

Designed to run 22:00~03:00 with CPU throttling.
Scans OneDrive folders for PDF, DOCX, HWP, HWPX, XLSX, PPTX, TXT
and merges into the existing knowledge graph.

Usage:
    python scripts/nightly_ingest.py [--dry-run] [--timeout 10] [--max-files 0]
"""

from __future__ import annotations

import argparse
import gc
import json
import logging
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

# Ensure src is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from mnemo.cache import BuildCache
from mnemo.graph_builder import build_graph, scan_vault_multiformat
from mnemo.parser import NoteDocument, parse_vault

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/TEST/MAISECONDBRAIN/logs/nightly-ingest.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("nightly-ingest")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ONEDRIVE_ROOT = Path("C:/Users/jini9/OneDrive")
MAIN_VAULT = ONEDRIVE_ROOT / "Documents" / "JINI_SYNC"
CACHE_DIR = Path("C:/TEST/MAISECONDBRAIN/.mnemo")
PROGRESS_FILE = CACHE_DIR / "nightly_progress.json"

# Folders to scan (order = priority)
SCAN_FOLDERS = [
    ONEDRIVE_ROOT / "01.COMPANY",
    ONEDRIVE_ROOT / "00. PRIVATE",
    ONEDRIVE_ROOT / "02.CLASS",
    ONEDRIVE_ROOT / "05.DOC",
    ONEDRIVE_ROOT / "06.CONSULTANT",
    ONEDRIVE_ROOT / "09.SEMINAR",
    ONEDRIVE_ROOT / "10.MANUAL",
    ONEDRIVE_ROOT / "11.STUDY",
    ONEDRIVE_ROOT / "JINI_OBS",
    ONEDRIVE_ROOT / "Documents",
]

SCAN_FORMATS = {".pdf", ".docx", ".hwp", ".hwpx", ".xlsx", ".pptx", ".txt"}
EXCLUDE_DIRS = {".obsidian", ".trash", ".git", "node_modules", ".mnemo", "__pycache__"}

# Per-file timeout (seconds)
DEFAULT_TIMEOUT = 10

# Throttle: sleep between files to reduce CPU load
SLEEP_BETWEEN_FILES = 0.05  # 50ms

# Max consecutive errors before skipping a folder
MAX_CONSECUTIVE_ERRORS = 20


# ---------------------------------------------------------------------------
# Timeout context
# ---------------------------------------------------------------------------

class FileTimeout:
    """Per-file timeout context manager (wall-clock based)."""

    def __init__(self, seconds: int):
        self.seconds = seconds
        self._deadline = 0.0

    def __enter__(self):
        self._deadline = time.time() + self.seconds
        return self

    def __exit__(self, *args):
        pass

    @property
    def expired(self) -> bool:
        return time.time() > self._deadline


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {"processed_files": {}, "last_run": None, "stats": {}}


def save_progress(progress: dict):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Safe single-file parser
# ---------------------------------------------------------------------------

def parse_file_safe(
    file_path: Path,
    vault_root: Path | None,
    timeout_sec: int,
) -> NoteDocument | None:
    """Parse a single file with timeout and error handling."""
    from mnemo.parsers import parse_document

    timer = FileTimeout(timeout_sec)
    with timer:
        try:
            doc = parse_document(file_path, vault_root)
            if timer.expired:
                return None
            return doc
        except Exception as e:
            log.debug("  Skip %s: %s", file_path.name, e)
            return None


# ---------------------------------------------------------------------------
# Folder scanner
# ---------------------------------------------------------------------------

def scan_folder(
    folder: Path,
    existing_keys: set[str],
    progress: dict,
    timeout_sec: int,
    max_files: int = 0,
    dry_run: bool = False,
) -> list[NoteDocument]:
    """Scan a folder for non-MD documents, with progress tracking."""
    if not folder.exists():
        log.warning("Folder not found: %s", folder)
        return []

    docs: list[NoteDocument] = []
    skipped = 0
    errors = 0
    consecutive_errors = 0
    processed = progress.get("processed_files", {})
    file_count = 0

    for file_path in sorted(folder.rglob("*")):
        if not file_path.is_file():
            continue

        suffix = file_path.suffix.lower()
        if suffix not in SCAN_FORMATS:
            continue

        if any(part in EXCLUDE_DIRS for part in file_path.parts):
            continue

        # Check if already processed (by path + mtime)
        fkey = str(file_path)
        try:
            mtime = str(file_path.stat().st_mtime)
        except OSError:
            continue

        prev_mtime = processed.get(fkey)
        if prev_mtime == mtime:
            skipped += 1
            continue

        if max_files and file_count >= max_files:
            log.info("  Max files reached (%d), stopping folder", max_files)
            break

        file_count += 1

        if dry_run:
            log.info("  [DRY] Would process: %s", file_path.name)
            continue

        doc = parse_file_safe(file_path, folder, timeout_sec)
        if doc:
            if doc.key not in existing_keys:
                docs.append(doc)
                existing_keys.add(doc.key)
            processed[fkey] = mtime
            consecutive_errors = 0
        else:
            errors += 1
            consecutive_errors += 1
            processed[fkey] = mtime  # Mark as attempted to avoid retry

        if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
            log.warning("  Too many consecutive errors (%d), skipping rest of folder", errors)
            break

        # Throttle CPU
        time.sleep(SLEEP_BETWEEN_FILES)

        # Periodic GC every 100 files
        if file_count % 100 == 0:
            gc.collect()
            log.info("  ... %d files processed, %d docs added, %d errors", file_count, len(docs), errors)

    log.info(
        "  Folder done: %d processed, %d new docs, %d skipped, %d errors",
        file_count, len(docs), skipped, errors,
    )
    return docs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Mnemo Nightly Ingest")
    parser.add_argument("--dry-run", action="store_true", help="List files without processing")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Per-file timeout (seconds)")
    parser.add_argument("--max-files", type=int, default=0, help="Max files per folder (0=unlimited)")
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("Nightly Ingest started at %s", datetime.now().isoformat())
    log.info("Timeout: %ds, Max files: %s, Dry run: %s", args.timeout, args.max_files or "unlimited", args.dry_run)

    t0 = time.time()

    # 1. Load main vault MD docs
    log.info("Phase 1: Loading main vault (JINI_SYNC)...")
    main_docs = parse_vault(str(MAIN_VAULT))
    log.info("  Main vault: %d MD docs", len(main_docs))

    # 2. Load extra MD docs
    log.info("Phase 2: Loading extra MD sources...")
    extra_md: list[NoteDocument] = []
    main_keys = {d.key for d in main_docs}

    for folder in [ONEDRIVE_ROOT / "01.COMPANY", ONEDRIVE_ROOT / "JINI_OBS", ONEDRIVE_ROOT / "Documents"]:
        if not folder.exists():
            continue
        md_docs = scan_vault_multiformat(folder, scan_formats={".md"})
        new = [d for d in md_docs if d.key not in main_keys]
        extra_md.extend(new)
        main_keys.update(d.key for d in new)
        log.info("  %s: +%d MD", folder.name, len(new))

    # 3. Scan non-MD formats
    progress = load_progress()
    existing_keys = {d.key for d in main_docs} | {d.key for d in extra_md}
    all_new_docs: list[NoteDocument] = []

    log.info("Phase 3: Scanning non-MD formats...")
    for folder in SCAN_FOLDERS:
        if not folder.exists():
            continue
        log.info("Scanning: %s", folder.name)
        new_docs = scan_folder(
            folder,
            existing_keys,
            progress,
            timeout_sec=args.timeout,
            max_files=args.max_files,
            dry_run=args.dry_run,
        )
        all_new_docs.extend(new_docs)

        # Save progress after each folder
        progress["last_run"] = datetime.now().isoformat()
        save_progress(progress)

    if args.dry_run:
        log.info("Dry run complete. No graph changes made.")
        return

    # 4. Build merged graph
    total_docs = main_docs + extra_md + all_new_docs
    log.info("Phase 4: Building graph (%d total docs)...", len(total_docs))

    G = build_graph(total_docs, include_tag_edges=True, min_tag_cooccurrence=3)
    log.info("  Graph: %d nodes, %d edges", G.number_of_nodes(), G.number_of_edges())

    # 5. Save graph via BuildCache (uses internal serialization)
    cache = BuildCache(str(CACHE_DIR))
    cache.save_graph(G)
    log.info("  Graph saved to %s", CACHE_DIR)

    # 6. Stats
    fmt_counts = Counter()
    for d in all_new_docs:
        fmt_counts[d.path.suffix.lower()] += 1

    elapsed = time.time() - t0
    stats = {
        "run_date": datetime.now().isoformat(),
        "elapsed_seconds": round(elapsed),
        "main_vault_docs": len(main_docs),
        "extra_md_docs": len(extra_md),
        "new_nonmd_docs": len(all_new_docs),
        "total_docs": len(total_docs),
        "graph_nodes": G.number_of_nodes(),
        "graph_edges": G.number_of_edges(),
        "format_breakdown": dict(fmt_counts.most_common()),
    }
    progress["stats"] = stats
    save_progress(progress)

    log.info("=" * 60)
    log.info("Nightly Ingest complete in %ds", elapsed)
    log.info("  New non-MD docs: %d (%s)", len(all_new_docs), dict(fmt_counts.most_common()))
    log.info("  Graph: %d nodes, %d edges", G.number_of_nodes(), G.number_of_edges())
    log.info("=" * 60)


if __name__ == "__main__":
    main()
