"""웹 검색 수집기 — Brave Search API를 통한 지식 수집"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote_plus


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    source: str = ""
    date: str = ""


@dataclass
class CollectedKnowledge:
    """수집된 외부 지식"""
    topic: str
    source_type: str  # web, youtube, twitter, rss, github, arxiv
    results: list[SearchResult] = field(default_factory=list)
    summary: str = ""
    tags: list[str] = field(default_factory=list)
    project: str | None = None
    collected_at: str = ""

    def to_obsidian_note(self) -> str:
        """Obsidian 마크다운 노트로 변환"""
        date = self.collected_at or datetime.now().strftime("%Y-%m-%d")
        tags_str = "\n".join(f"  - {t}" for t in self.tags)

        fm = f"""---
type: source
source_type: {self.source_type}
topic: "{self.topic}"
collected_at: {date}
tags:
  - 외부지식
  - {self.source_type}
{tags_str}
"""
        if self.project:
            fm += f"project: {self.project}\n"
        fm += "---\n\n"

        body = f"# {self.topic}\n\n"

        if self.summary:
            body += f"## 요약\n\n{self.summary}\n\n"

        body += f"## 수집 결과\n\n"
        for i, r in enumerate(self.results, 1):
            body += f"### {i}. {r.title}\n"
            body += f"- **URL:** {r.url}\n"
            if r.date:
                body += f"- **날짜:** {r.date}\n"
            body += f"- **요약:** {r.snippet}\n\n"

        body += f"\n---\n*수집: {date} | 소스: {self.source_type}*\n"
        return fm + body


def search_brave(
    query: str,
    api_key: str | None = None,
    count: int = 5,
    freshness: str | None = None,
) -> list[SearchResult]:
    """Brave Search API로 검색"""
    if not api_key:
        # 환경변수에서
        import os
        api_key = os.environ.get("BRAVE_API_KEY", "")
    if not api_key:
        return []

    url = f"https://api.search.brave.com/res/v1/web/search?q={quote_plus(query)}&count={count}"
    if freshness:
        url += f"&freshness={freshness}"

    req = Request(url, headers={
        "Accept": "application/json",
        "X-Subscription-Token": api_key,
    })

    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        results = []
        for item in data.get("web", {}).get("results", []):
            results.append(SearchResult(
                title=item.get("title", ""),
                url=item.get("url", ""),
                snippet=item.get("description", ""),
                date=item.get("age", ""),
            ))
        return results
    except Exception as e:
        print(f"  Brave search error: {e}")
        return []


def search_youtube(
    query: str,
    max_results: int = 5,
) -> list[SearchResult]:
    """YouTube 검색 (RSS feed 기반, API 키 불필요)"""
    url = f"https://www.youtube.com/results?search_query={quote_plus(query)}&sp=CAI%253D"

    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")

        # JSON 데이터 추출
        pattern = r'var ytInitialData = ({.*?});</script>'
        match = re.search(pattern, html)
        if not match:
            return []

        data = json.loads(match.group(1))
        results = []

        contents = (
            data.get("contents", {})
            .get("twoColumnSearchResultsRenderer", {})
            .get("primaryContents", {})
            .get("sectionListRenderer", {})
            .get("contents", [{}])[0]
            .get("itemSectionRenderer", {})
            .get("contents", [])
        )

        for item in contents[:max_results]:
            video = item.get("videoRenderer", {})
            if not video:
                continue
            title = video.get("title", {}).get("runs", [{}])[0].get("text", "")
            video_id = video.get("videoId", "")
            snippet_runs = video.get("detailedMetadataSnippets", [{}])
            snippet = ""
            if snippet_runs:
                snippet = "".join(
                    r.get("text", "") for r in snippet_runs[0].get("snippetText", {}).get("runs", [])
                )

            if title and video_id:
                results.append(SearchResult(
                    title=title,
                    url=f"https://youtube.com/watch?v={video_id}",
                    snippet=snippet or title,
                    source="youtube",
                ))

        return results
    except Exception as e:
        print(f"  YouTube search error: {e}")
        return []


def search_github_trending(
    language: str = "python",
    since: str = "daily",
) -> list[SearchResult]:
    """GitHub trending repos"""
    url = f"https://api.github.com/search/repositories?q=language:{language}&sort=stars&order=desc&per_page=5"

    try:
        req = Request(url, headers={
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Mnemo-Collector",
        })
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        results = []
        for repo in data.get("items", []):
            results.append(SearchResult(
                title=repo.get("full_name", ""),
                url=repo.get("html_url", ""),
                snippet=repo.get("description", "") or "",
                date=repo.get("updated_at", "")[:10],
                source="github",
            ))
        return results
    except Exception as e:
        print(f"  GitHub search error: {e}")
        return []
