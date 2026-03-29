"""외부 지식 수집 → Obsidian 노트 변환 파이프라인"""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from .web_collector import (
    CollectedKnowledge,
    SearchResult,
    search_brave,
    search_github_trending,
    search_youtube,
)

# 프로젝트별 관심 토픽
PROJECT_TOPICS = {
    "MAIOSS": [
        ("OSS security scanner 2026", "오픈소스 보안 스캐너 최신 동향"),
        ("SBOM vulnerability detection AI", "SBOM AI 취약점 탐지"),
        ("software composition analysis tools", "SCA 도구 트렌드"),
    ],
    "MAIBEAUTY": [
        ("K-beauty Vietnam TikTok commerce", "K뷰티 베트남 TikTok 커머스"),
        ("AI cosmetics recommendation", "AI 화장품 추천"),
        ("Vietnam beauty market 2026", "베트남 뷰티 시장 동향"),
    ],
    "MAITOK": [
        ("TikTok comment AI analysis", "TikTok 댓글 AI 분석"),
        ("social commerce automation", "소셜커머스 자동화"),
        ("short-form video AI tools", "숏폼 AI 도구"),
    ],
    "MAISECONDBRAIN": [
        ("personal knowledge graph RAG", "개인 지식그래프 RAG"),
        ("Obsidian plugin development 2026", "옵시디언 플러그인 개발"),
        ("second brain AI automation", "세컨드브레인 AI 자동화"),
    ],
    "MAIAX": [
        ("smart manufacturing AI automation", "스마트제조 AI 자동화"),
        ("industrial LLM RAG pipeline", "산업용 LLM RAG 파이프라인"),
    ],
    "MAITUTOR": [
        ("AI tutoring personalized learning", "AI 개인화 학습"),
        ("education technology 2026", "에듀테크 트렌드"),
    ],
    "MAIBOTALKS": [
        ("voice AI conversation agent", "음성 AI 대화 에이전트"),
        ("speech-to-text real-time", "실시간 음성인식"),
    ],
    "GENERAL_AI": [
        ("AI agent framework 2026", "AI 에이전트 프레임워크"),
        ("LLM benchmark latest", "LLM 벤치마크 최신"),
        ("AI monetization strategy", "AI 수익화 전략"),
        ("RAG advanced techniques", "RAG 고급 기법"),
    ],
}

# 토픽 → 태그 매핑
TOPIC_TAG_MAP = {
    "security": ["보안", "MAIOSS"],
    "beauty": ["화장품", "MAIBEAUTY"],
    "tiktok": ["TikTok", "MAITOK"],
    "knowledge": ["지식그래프", "MAISECONDBRAIN"],
    "manufacturing": ["스마트제조", "MAIAX"],
    "education": ["교육", "MAITUTOR"],
    "voice": ["음성AI", "MAIBOTALKS"],
    "LLM": ["LLM", "AI"],
    "RAG": ["RAG", "AI"],
    "agent": ["AI에이전트", "AI"],
}


def infer_tags(topic: str, results: list[SearchResult]) -> list[str]:
    """토픽과 결과에서 태그 추론"""
    tags = set()
    combined = topic.lower() + " " + " ".join(r.title.lower() + r.snippet.lower() for r in results)

    for keyword, tag_list in TOPIC_TAG_MAP.items():
        if keyword.lower() in combined:
            tags.update(tag_list)

    return sorted(tags)


def collect_project_knowledge(
    project: str,
    brave_api_key: str | None = None,
    include_youtube: bool = True,
    include_github: bool = False,
) -> list[CollectedKnowledge]:
    """프로젝트별 외부 지식 수집"""
    topics = PROJECT_TOPICS.get(project, [])
    collected = []

    for en_query, ko_topic in topics:
        knowledge = CollectedKnowledge(
            topic=ko_topic,
            source_type="web",
            project=project,
            collected_at=datetime.now().strftime("%Y-%m-%d"),
        )

        # 웹 검색
        web_results = search_brave(en_query, api_key=brave_api_key, count=3, freshness="pm")
        knowledge.results.extend(web_results)

        # YouTube
        if include_youtube:
            yt_results = search_youtube(en_query, max_results=2)
            for r in yt_results:
                r.source = "youtube"
            knowledge.results.extend(yt_results)
            if yt_results:
                knowledge.source_type = "web+youtube"

        # 태그 추론
        knowledge.tags = infer_tags(ko_topic, knowledge.results)

        if knowledge.results:
            collected.append(knowledge)

    return collected


def collect_all_projects(
    brave_api_key: str | None = None,
    projects: list[str] | None = None,
) -> list[CollectedKnowledge]:
    """전체 프로젝트 지식 수집"""
    if projects is None:
        projects = list(PROJECT_TOPICS.keys())

    all_knowledge = []
    for project in projects:
        knowledge = collect_project_knowledge(project, brave_api_key=brave_api_key)
        all_knowledge.extend(knowledge)

    return all_knowledge


def save_to_vault(
    knowledge_list: list[CollectedKnowledge],
    vault_path: str,
    subfolder: str = "03.RESOURCES/외부지식",
    existing_notes: list[str] | None = None,
    min_trust_grade: str = "D",
) -> list[Path]:
    """수집된 지식을 신뢰도 평가 후 Obsidian 볼트에 저장

    Args:
        min_trust_grade: 이 등급 이상만 저장 ("A", "B", "C", "D")
    """
    from .trust_evaluator import evaluate_trust, trust_to_frontmatter, trust_to_markdown

    grade_order = {"A": 4, "B": 3, "C": 2, "D": 1}
    min_grade_val = grade_order.get(min_trust_grade, 1)

    base = Path(vault_path) / subfolder
    base.mkdir(parents=True, exist_ok=True)

    saved = []
    skipped = 0
    date = datetime.now().strftime("%Y-%m-%d")

    for k in knowledge_list:
        # 신뢰도 평가
        trust = evaluate_trust(k, existing_notes=existing_notes)

        # 등급 필터
        if grade_order.get(trust.grade, 0) < min_grade_val:
            skipped += 1
            continue

        # 파일명: 날짜_등급_토픽
        safe_topic = re.sub(r'[<>:"/\\|?*]', '_', k.topic)
        filename = f"{date}_{trust.grade}_{safe_topic}.md"
        filepath = base / filename

        if filepath.exists():
            continue

        # 노트 생성 (신뢰도 정보 포함)
        content = k.to_obsidian_note()

        # frontmatter에 신뢰도 필드 추가
        trust_fm = trust_to_frontmatter(trust)
        fm_insert = "\n".join(f"{k}: {v}" for k, v in trust_fm.items())
        content = content.replace("---\n\n#", f"{fm_insert}\n---\n\n#", 1)

        # 본문에 신뢰도 섹션 추가
        trust_section = "\n\n" + trust_to_markdown(trust) + "\n"
        content = content.rstrip() + trust_section

        filepath.write_text(content, encoding="utf-8")
        saved.append(filepath)

    if skipped:
        print(f"  ⚠️ {skipped}개 노트 신뢰도 미달로 제외 (< {min_trust_grade})")

    return saved
