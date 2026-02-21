"""증분 빌드 캐시 — 파일 해시 기반 변경 감지"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import networkx as nx

DEFAULT_CACHE_DIR = ".mnemo"


class BuildCache:
    """볼트 빌드 캐시 관리"""

    def __init__(self, cache_dir: str | Path = DEFAULT_CACHE_DIR):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.checksums_path = self.cache_dir / "checksums.json"
        self.graph_path = self.cache_dir / "graph.pkl"
        self.stats_path = self.cache_dir / "stats.json"

    def load_checksums(self) -> dict[str, str]:
        """저장된 체크섬 로드"""
        if self.checksums_path.exists():
            return json.loads(self.checksums_path.read_text(encoding="utf-8"))
        return {}

    def save_checksums(self, checksums: dict[str, str]) -> None:
        """체크섬 저장"""
        self.checksums_path.write_text(
            json.dumps(checksums, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def save_graph(self, G: nx.DiGraph) -> None:
        """그래프 직렬화 저장"""
        with open(self.graph_path, "wb") as f:
            pickle.dump(G, f, protocol=pickle.HIGHEST_PROTOCOL)

    def load_graph(self) -> nx.DiGraph | None:
        """저장된 그래프 로드"""
        if self.graph_path.exists():
            with open(self.graph_path, "rb") as f:
                return pickle.load(f)  # noqa: S301
        return None

    def save_stats(self, stats: dict) -> None:
        """통계 저장"""
        self.stats_path.write_text(
            json.dumps(stats, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    def load_stats(self) -> dict | None:
        """저장된 통계 로드"""
        if self.stats_path.exists():
            return json.loads(self.stats_path.read_text(encoding="utf-8"))
        return None

    def get_changed_files(
        self, current_checksums: dict[str, str]
    ) -> tuple[list[str], list[str], list[str]]:
        """변경/추가/삭제 파일 감지.

        Returns:
            (added, modified, deleted) 파일명 리스트
        """
        cached = self.load_checksums()

        added = [f for f in current_checksums if f not in cached]
        deleted = [f for f in cached if f not in current_checksums]
        modified = [
            f for f in current_checksums
            if f in cached and current_checksums[f] != cached[f]
        ]

        return added, modified, deleted
