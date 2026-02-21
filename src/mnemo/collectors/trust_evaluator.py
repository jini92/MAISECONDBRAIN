"""외부 지식 신뢰도 평가 + 크로스체크 시스템

신뢰도 평가 기준:
1. 소스 신뢰도 (Source Trust) — 출처의 권위/신뢰성
2. 교차 검증 (Cross-check) — 여러 소스에서 같은 정보 확인
3. 내부 일관성 (Internal Consistency) — 기존 지식그래프와 모순 여부
4. 시의성 (Freshness) — 정보의 최신성
5. 구체성 (Specificity) — 주장의 구체성/검증가능성

신뢰도 등급:
  A (0.8~1.0): 높은 신뢰 — 공식 문서, 학술 논문, 복수 소스 확인
  B (0.6~0.8): 보통 신뢰 — 전문 블로그, 단일 신뢰 소스
  C (0.4~0.6): 낮은 신뢰 — 개인 의견, 미확인, 소셜미디어
  D (0.0~0.4): 미신뢰 — 모순 발견, 출처 불명, 광고성
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .web_collector import CollectedKnowledge, SearchResult


# 소스 도메인 신뢰도 사전
DOMAIN_TRUST = {
    # 높은 신뢰 (0.9+)
    "arxiv.org": 0.95,
    "github.com": 0.85,
    "docs.python.org": 0.95,
    "pytorch.org": 0.90,
    "huggingface.co": 0.85,
    "openai.com": 0.90,
    "anthropic.com": 0.90,
    "google.ai": 0.90,
    "microsoft.com": 0.85,
    "ieee.org": 0.95,
    "acm.org": 0.95,
    "nature.com": 0.95,
    "sciencedirect.com": 0.90,
    # 보통 신뢰 (0.6~0.8)
    "medium.com": 0.60,
    "dev.to": 0.65,
    "stackoverflow.com": 0.75,
    "reddit.com": 0.50,
    "youtube.com": 0.55,
    "towardsdatascience.com": 0.70,
    "techcrunch.com": 0.75,
    "theverge.com": 0.70,
    "wired.com": 0.75,
    # 낮은 신뢰 (기본값)
    "_default": 0.45,
}

# 신뢰 키워드 (내용에 포함 시 가산/감산)
TRUST_BOOST_KEYWORDS = [
    "peer-reviewed", "published", "benchmark", "experiment",
    "official", "documentation", "specification", "RFC",
    "연구", "논문", "실험", "벤치마크", "공식",
]
TRUST_PENALTY_KEYWORDS = [
    "sponsored", "advertisement", "affiliate", "opinion",
    "rumor", "unconfirmed", "alleged", "clickbait",
    "광고", "협찬", "추측", "루머", "미확인",
]


@dataclass
class TrustScore:
    """신뢰도 평가 결과"""
    overall: float = 0.0
    source_trust: float = 0.0
    cross_check: float = 0.0
    consistency: float = 0.0
    freshness: float = 0.0
    specificity: float = 0.0
    grade: str = "D"
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def grade_emoji(self) -> str:
        return {"A": "🟢", "B": "🔵", "C": "🟡", "D": "🔴"}.get(self.grade, "⚪")


def _extract_domain(url: str) -> str:
    """URL에서 도메인 추출"""
    match = re.search(r"https?://(?:www\.)?([^/]+)", url)
    return match.group(1) if match else ""


def _score_source_trust(results: list[SearchResult]) -> tuple[float, list[str]]:
    """소스 신뢰도 평가"""
    if not results:
        return 0.0, ["결과 없음"]

    scores = []
    reasons = []

    for r in results:
        domain = _extract_domain(r.url)
        # 도메인 매칭 (부분 매칭)
        trust = DOMAIN_TRUST.get("_default", 0.45)
        for known_domain, known_trust in DOMAIN_TRUST.items():
            if known_domain in domain:
                trust = known_trust
                break

        # 키워드 보너스/패널티
        content = (r.title + " " + r.snippet).lower()
        for kw in TRUST_BOOST_KEYWORDS:
            if kw.lower() in content:
                trust = min(trust + 0.05, 1.0)
        for kw in TRUST_PENALTY_KEYWORDS:
            if kw.lower() in content:
                trust = max(trust - 0.1, 0.1)

        scores.append(trust)
        if trust >= 0.8:
            reasons.append(f"신뢰 소스: {domain} ({trust:.2f})")
        elif trust < 0.5:
            reasons.append(f"낮은 신뢰: {domain} ({trust:.2f})")

    return sum(scores) / len(scores), reasons


def _score_cross_check(results: list[SearchResult]) -> tuple[float, list[str]]:
    """교차 검증 — 서로 다른 소스에서 유사한 정보 확인"""
    if len(results) < 2:
        return 0.3, ["단일 소스 — 교차 검증 불가"]

    # 서로 다른 도메인 수
    domains = set(_extract_domain(r.url) for r in results)
    domain_diversity = min(len(domains) / 3.0, 1.0)  # 3개 이상이면 만점

    # 내용 유사도 (키워드 겹침)
    all_words = []
    for r in results:
        words = set(re.findall(r'\w{3,}', (r.title + " " + r.snippet).lower()))
        all_words.append(words)

    overlap_scores = []
    for i in range(len(all_words)):
        for j in range(i + 1, len(all_words)):
            if all_words[i] and all_words[j]:
                overlap = len(all_words[i] & all_words[j]) / min(len(all_words[i]), len(all_words[j]))
                overlap_scores.append(overlap)

    content_agreement = sum(overlap_scores) / len(overlap_scores) if overlap_scores else 0.0

    score = 0.5 * domain_diversity + 0.5 * content_agreement
    reasons = []
    reasons.append(f"{len(domains)}개 소스 확인 (다양성: {domain_diversity:.2f})")
    if content_agreement > 0.3:
        reasons.append(f"소스 간 내용 일치도: {content_agreement:.2f}")
    else:
        reasons.append(f"소스 간 내용 불일치: {content_agreement:.2f}")

    return score, reasons


def _score_freshness(results: list[SearchResult]) -> tuple[float, list[str]]:
    """시의성 평가"""
    now = datetime.now()
    reasons = []

    # 날짜 파싱 시도
    dates_found = 0
    recent_count = 0

    for r in results:
        date_str = r.date
        if not date_str:
            continue

        # "2 days ago", "1 week ago" 등
        if "day" in date_str.lower():
            dates_found += 1
            recent_count += 1
        elif "week" in date_str.lower():
            dates_found += 1
            recent_count += 1
        elif "month" in date_str.lower():
            dates_found += 1
        elif re.match(r"\d{4}-\d{2}-\d{2}", date_str):
            dates_found += 1
            try:
                d = datetime.strptime(date_str[:10], "%Y-%m-%d")
                if (now - d).days < 90:
                    recent_count += 1
            except ValueError:
                pass

    if dates_found == 0:
        return 0.5, ["날짜 정보 없음"]

    freshness = recent_count / dates_found
    if freshness > 0.5:
        reasons.append(f"최근 정보 비율: {recent_count}/{dates_found}")
    else:
        reasons.append(f"오래된 정보 다수: {dates_found - recent_count}/{dates_found}")

    return freshness, reasons


def _score_specificity(results: list[SearchResult]) -> tuple[float, list[str]]:
    """구체성 평가 — 수치, 데이터, 구체적 주장 포함 여부"""
    specificity_indicators = 0
    total_checked = 0
    reasons = []

    for r in results:
        content = r.title + " " + r.snippet
        total_checked += 1

        # 수치 포함
        if re.search(r'\d+\.?\d*\s*(%|percent|배|times|x)', content, re.IGNORECASE):
            specificity_indicators += 1
        # 날짜/버전 포함
        if re.search(r'(v?\d+\.\d+|20\d{2})', content):
            specificity_indicators += 1
        # 비교/벤치마크
        if re.search(r'(vs|compared|benchmark|outperform|대비|비교)', content, re.IGNORECASE):
            specificity_indicators += 1

    if total_checked == 0:
        return 0.5, ["평가 불가"]

    score = min(specificity_indicators / (total_checked * 2), 1.0)
    if score > 0.5:
        reasons.append(f"구체적 데이터 포함 ({specificity_indicators}개 지표)")
    else:
        reasons.append("구체적 수치/데이터 부족")

    return score, reasons


def evaluate_trust(
    knowledge: CollectedKnowledge,
    existing_notes: list[str] | None = None,
) -> TrustScore:
    """외부 지식의 종합 신뢰도 평가

    Args:
        knowledge: 수집된 외부 지식
        existing_notes: 기존 볼트의 노트 이름 목록 (일관성 검사용)

    Returns:
        TrustScore
    """
    ts = TrustScore()

    # 1. 소스 신뢰도 (30%)
    ts.source_trust, src_reasons = _score_source_trust(knowledge.results)
    ts.reasons.extend(src_reasons)

    # 2. 교차 검증 (25%)
    ts.cross_check, xc_reasons = _score_cross_check(knowledge.results)
    ts.reasons.extend(xc_reasons)

    # 3. 내부 일관성 (15%) — 기존 지식과 모순 체크
    if existing_notes:
        # 토픽 관련 기존 노트 존재 여부
        topic_words = set(re.findall(r'\w{3,}', knowledge.topic.lower()))
        related = sum(1 for n in existing_notes if topic_words & set(re.findall(r'\w{3,}', n.lower())))
        ts.consistency = min(related / 5.0, 1.0) if related > 0 else 0.5
        if related > 0:
            ts.reasons.append(f"기존 관련 노트 {related}개 (일관성 검증 가능)")
        else:
            ts.reasons.append("기존 관련 지식 없음 — 신규 토픽")
    else:
        ts.consistency = 0.5

    # 4. 시의성 (15%)
    ts.freshness, fresh_reasons = _score_freshness(knowledge.results)
    ts.reasons.extend(fresh_reasons)

    # 5. 구체성 (15%)
    ts.specificity, spec_reasons = _score_specificity(knowledge.results)
    ts.reasons.extend(spec_reasons)

    # 종합 점수 (가중 평균)
    ts.overall = (
        0.30 * ts.source_trust
        + 0.25 * ts.cross_check
        + 0.15 * ts.consistency
        + 0.15 * ts.freshness
        + 0.15 * ts.specificity
    )

    # 등급
    if ts.overall >= 0.8:
        ts.grade = "A"
    elif ts.overall >= 0.6:
        ts.grade = "B"
    elif ts.overall >= 0.4:
        ts.grade = "C"
    else:
        ts.grade = "D"

    # 경고
    if ts.source_trust < 0.5:
        ts.warnings.append("⚠️ 소스 신뢰도 낮음 — 추가 검증 권장")
    if ts.cross_check < 0.3:
        ts.warnings.append("⚠️ 교차 검증 부족 — 단일 소스 의존")
    if ts.overall < 0.4:
        ts.warnings.append("🔴 신뢰도 D등급 — 지식그래프 편입 보류 권장")

    return ts


def trust_to_frontmatter(ts: TrustScore) -> dict:
    """신뢰도 평가 결과를 frontmatter 필드로 변환"""
    return {
        "trust_grade": ts.grade,
        "trust_score": round(ts.overall, 2),
        "trust_source": round(ts.source_trust, 2),
        "trust_crosscheck": round(ts.cross_check, 2),
        "trust_freshness": round(ts.freshness, 2),
        "trust_specificity": round(ts.specificity, 2),
    }


def trust_to_markdown(ts: TrustScore) -> str:
    """신뢰도 평가 결과를 마크다운 섹션으로"""
    lines = [
        f"## 신뢰도 평가 {ts.grade_emoji} {ts.grade} ({ts.overall:.2f})",
        "",
        "| 항목 | 점수 |",
        "|------|------|",
        f"| 소스 신뢰도 | {ts.source_trust:.2f} |",
        f"| 교차 검증 | {ts.cross_check:.2f} |",
        f"| 내부 일관성 | {ts.consistency:.2f} |",
        f"| 시의성 | {ts.freshness:.2f} |",
        f"| 구체성 | {ts.specificity:.2f} |",
        f"| **종합** | **{ts.overall:.2f}** |",
        "",
    ]

    if ts.reasons:
        lines.append("**근거:**")
        for r in ts.reasons:
            lines.append(f"- {r}")
        lines.append("")

    if ts.warnings:
        lines.append("**경고:**")
        for w in ts.warnings:
            lines.append(f"- {w}")

    return "\n".join(lines)
