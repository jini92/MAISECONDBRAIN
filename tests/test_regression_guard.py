"""Regression guard tests -- 2026-03-12.

Lock critical search parameters to prevent accidental changes.
Uses inspect + re to verify source code defaults without API calls.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))


class TestCriticalSettings:
    """Guard tests for critical MAISECONDBRAIN search parameters."""

    def test_hybrid_keyword_weight_is_05(self) -> None:
        """Hybrid keyword weight must be 0.5 (dominant factor)."""
        from mnemo.hybrid_search import hybrid_search
        import inspect as _i

        src = _i.getsource(hybrid_search)
        match = re.search(r"keyword_weight:\s*float\s*=\s*([\d.]+)", src)
        assert match is not None, "keyword_weight default must be defined"
        assert float(match.group(1)) == 0.5, (
            f"keyword_weight must be 0.5, got {match.group(1)}"
        )

    def test_hybrid_vector_weight_is_03(self) -> None:
        """Hybrid vector weight must be 0.3."""
        from mnemo.hybrid_search import hybrid_search
        import inspect as _i

        src = _i.getsource(hybrid_search)
        match = re.search(r"vector_weight:\s*float\s*=\s*([\d.]+)", src)
        assert match is not None, "vector_weight default must be defined"
        assert float(match.group(1)) == 0.3, (
            f"vector_weight must be 0.3, got {match.group(1)}"
        )

    def test_hybrid_graph_weight_is_02(self) -> None:
        """Hybrid graph weight must be 0.2."""
        from mnemo.hybrid_search import hybrid_search
        import inspect as _i

        src = _i.getsource(hybrid_search)
        match = re.search(r"graph_weight:\s*float\s*=\s*([\d.]+)", src)
        assert match is not None, "graph_weight default must be defined"
        assert float(match.group(1)) == 0.2, (
            f"graph_weight must be 0.2, got {match.group(1)}"
        )

    def test_hybrid_top_k_is_10(self) -> None:
        """Hybrid search top_k must default to 10."""
        from mnemo.hybrid_search import hybrid_search
        import inspect as _i

        src = _i.getsource(hybrid_search)
        match = re.search(r"top_k:\s*int\s*=\s*(\d+)", src)
        assert match is not None, "top_k default must be defined"
        assert match.group(1) == "10", (
            f"hybrid_search top_k must be 10, got {match.group(1)}"
        )

    def test_integrated_search_memory_top_k_is_5(self) -> None:
        """Memory search top_k must default to 5."""
        src_path = PROJECT_ROOT / "scripts" / "integrated_search.py"
        src = src_path.read_text(encoding="utf-8")
        # Find search_memory_files function default
        match = re.search(
            r"def search_memory_files\(.*?top_k:\s*int\s*=\s*(\d+)",
            src,
            re.DOTALL,
        )
        assert match is not None, "search_memory_files top_k default must be defined"
        assert match.group(1) == "5", (
            f"search_memory_files top_k must be 5, got {match.group(1)}"
        )

    def test_graphrag_hops_is_2(self) -> None:
        """GraphRAG expansion must use 2 hops."""
        src_path = PROJECT_ROOT / "scripts" / "integrated_search.py"
        src = src_path.read_text(encoding="utf-8")
        # Find hops=2 in graphrag_query call
        match = re.search(r"hops=(\d+)", src)
        assert match is not None, "graphrag hops must be defined"
        assert match.group(1) == "2", (
            f"graphrag hops must be 2, got {match.group(1)}"
        )