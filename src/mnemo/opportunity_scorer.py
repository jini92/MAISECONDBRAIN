"""기여-수익 스코어링 모듈 — MAI Universe 4사분면 평가"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ScoreBreakdown:
    """개별 점수 항목 상세"""
    score: float
    reasons: list[str] = field(default_factory=list)


@dataclass
class OpportunityScore:
    """기회 스코어링 결과"""
    name: str
    contribution: ScoreBreakdown = field(default_factory=lambda: ScoreBreakdown(0))
    revenue: ScoreBreakdown = field(default_factory=lambda: ScoreBreakdown(0))
    synergy: ScoreBreakdown = field(default_factory=lambda: ScoreBreakdown(0))
    feasibility: ScoreBreakdown = field(default_factory=lambda: ScoreBreakdown(0))

    # 가중치
    WEIGHTS = {"contribution": 0.25, "revenue": 0.30, "synergy": 0.20, "feasibility": 0.25}

    @property
    def total(self) -> float:
        w = self.WEIGHTS
        return round(
            self.contribution.score * w["contribution"]
            + self.revenue.score * w["revenue"]
            + self.synergy.score * w["synergy"]
            + self.feasibility.score * w["feasibility"],
            2,
        )

    @property
    def quadrant(self) -> str:
        c = self.contribution.score
        r = self.revenue.score
        if c >= 6 and r >= 6:
            return "🟢 황금지대"
        elif c < 6 and r >= 6:
            return "🟡 순수수익"
        elif c >= 6 and r < 6:
            return "🔵 씨앗"
        else:
            return "🔴 피하기"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "contribution_score": self.contribution.score,
            "contribution_reasons": self.contribution.reasons,
            "revenue_score": self.revenue.score,
            "revenue_reasons": self.revenue.reasons,
            "synergy_score": self.synergy.score,
            "synergy_reasons": self.synergy.reasons,
            "feasibility_score": self.feasibility.score,
            "feasibility_reasons": self.feasibility.reasons,
            "total_score": self.total,
            "quadrant": self.quadrant,
        }


def _score_contribution(tags: dict) -> ScoreBreakdown:
    score = 0.0
    reasons = []
    if tags.get("open_source"):
        score += 3
        reasons.append("오픈소스 코드 공개 +3")
    if tags.get("free_tool"):
        score += 2
        reasons.append("무료 도구/플러그인 제공 +2")
    if tags.get("education"):
        score += 2
        reasons.append("교육 콘텐츠 +2")
    if tags.get("social_impact"):
        score += 2
        reasons.append("사회적 문제 해결 +2")
    if tags.get("community"):
        score += 1
        reasons.append("커뮤니티 형성 +1")
    return ScoreBreakdown(min(score, 10), reasons)


def _score_revenue(tags: dict) -> ScoreBreakdown:
    score = 0.0
    reasons = []
    if tags.get("recurring"):
        score += 3
        reasons.append("반복 수익 (구독/SaaS) +3")
    if tags.get("high_margin"):
        score += 2
        reasons.append("높은 마진 +2")
    if tags.get("large_tam"):
        score += 2
        reasons.append("시장 크기 (TAM > $1B) +2")
    if tags.get("fast_bep"):
        score += 2
        reasons.append("빠른 BEP +2")
    if tags.get("multi_channel"):
        score += 1
        reasons.append("다중 수익 채널 +1")
    return ScoreBreakdown(min(score, 10), reasons)


def _score_synergy(tags: dict) -> ScoreBreakdown:
    score = 0.0
    reasons = []
    if tags.get("shared_infra"):
        score += 3
        reasons.append("인프라 공유 가능 +3")
    if tags.get("cross_sell"):
        score += 2
        reasons.append("크로스 셀링 가능 +2")
    if tags.get("shared_data"):
        score += 2
        reasons.append("데이터 공유 가능 +2")
    if tags.get("shared_tech"):
        score += 2
        reasons.append("기술 스택 공유 +2")
    if tags.get("brand_synergy"):
        score += 1
        reasons.append("브랜드 시너지 +1")
    return ScoreBreakdown(min(score, 10), reasons)


def _score_feasibility(tags: dict) -> ScoreBreakdown:
    score = 0.0
    reasons = []
    if tags.get("existing_tech"):
        score += 3
        reasons.append("기존 기술로 구현 가능 +3")
    if tags.get("solo_dev"):
        score += 2
        reasons.append("1인 개발 가능 (MAIBOT 지원) +2")
    if tags.get("low_regulation"):
        score += 2
        reasons.append("규제 리스크 낮음 +2")
    if tags.get("mvp_1month"):
        score += 2
        reasons.append("MVP 1개월 이내 +2")
    if tags.get("low_dependency"):
        score += 1
        reasons.append("외부 의존성 낮음 +1")
    return ScoreBreakdown(min(score, 10), reasons)


def score_opportunity(name: str, tags: dict) -> OpportunityScore:
    """태그 기반으로 기회를 스코어링한다."""
    return OpportunityScore(
        name=name,
        contribution=_score_contribution(tags),
        revenue=_score_revenue(tags),
        synergy=_score_synergy(tags),
        feasibility=_score_feasibility(tags),
    )


# ── 기존 9개 프로젝트 프로필 ──────────────────────────────────

MAI_PROJECTS: dict[str, dict] = {
    "MAIBOT": {
        "open_source": False, "free_tool": True, "education": False,
        "social_impact": False, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": True,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": False, "low_dependency": True,
    },
    "MAITCAD": {
        "open_source": True, "free_tool": True, "education": False,
        "social_impact": True, "community": False,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": False, "multi_channel": False,
        "shared_infra": True, "cross_sell": True, "shared_data": False,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": False, "low_dependency": False,
    },
    "MAIPnID": {
        "open_source": True, "free_tool": True, "education": False,
        "social_impact": True, "community": False,
        "recurring": True, "high_margin": True, "large_tam": False,
        "fast_bep": False, "multi_channel": False,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": False, "low_dependency": False,
    },
    "MAIAX": {
        "open_source": False, "free_tool": False, "education": False,
        "social_impact": True, "community": False,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": False, "multi_channel": True,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": False,
        "mvp_1month": False, "low_dependency": False,
    },
    "MAIOSS": {
        "open_source": True, "free_tool": True, "education": True,
        "social_impact": True, "community": True,
        "recurring": False, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": True, "cross_sell": False, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAITB": {
        "open_source": True, "free_tool": True, "education": True,
        "social_impact": False, "community": True,
        "recurring": False, "high_margin": True, "large_tam": False,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": True, "cross_sell": False, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAITHINK": {
        "open_source": False, "free_tool": True, "education": True,
        "social_impact": True, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": True,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAIBEAUTY": {
        "open_source": False, "free_tool": False, "education": False,
        "social_impact": False, "community": False,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": True,
        "shared_infra": False, "cross_sell": False, "shared_data": False,
        "shared_tech": True, "brand_synergy": False,
        "existing_tech": True, "solo_dev": True, "low_regulation": False,
        "mvp_1month": False, "low_dependency": False,
    },
    "MAISTAR7": {
        "open_source": False, "free_tool": True, "education": True,
        "social_impact": True, "community": True,
        "recurring": True, "high_margin": True, "large_tam": False,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAICON": {
        "open_source": False, "free_tool": True, "education": False,
        "social_impact": True, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": False,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAITUTOR": {
        "open_source": False, "free_tool": True, "education": True,
        "social_impact": True, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": True,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAIBOTALKS": {
        "open_source": False, "free_tool": False, "education": False,
        "social_impact": False, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": True, "cross_sell": True, "shared_data": False,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAITOK": {
        "open_source": False, "free_tool": True, "education": False,
        "social_impact": False, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAISECONDBRAIN": {
        "open_source": True, "free_tool": True, "education": True,
        "social_impact": True, "community": True,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": True,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAIPatent": {
        "open_source": False, "free_tool": False, "education": False,
        "social_impact": False, "community": False,
        "recurring": True, "high_margin": True, "large_tam": False,
        "fast_bep": False, "multi_channel": False,
        "shared_infra": True, "cross_sell": False, "shared_data": False,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": False,
        "mvp_1month": False, "low_dependency": False,
    },
    "MAITalkCart": {
        "open_source": False, "free_tool": False, "education": False,
        "social_impact": False, "community": False,
        "recurring": True, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": True,
        "shared_infra": True, "cross_sell": True, "shared_data": True,
        "shared_tech": True, "brand_synergy": True,
        "existing_tech": True, "solo_dev": True, "low_regulation": True,
        "mvp_1month": True, "low_dependency": True,
    },
    "MAIUPbit": {
        "open_source": False, "free_tool": False, "education": False,
        "social_impact": False, "community": False,
        "recurring": False, "high_margin": True, "large_tam": True,
        "fast_bep": True, "multi_channel": False,
        "shared_infra": False, "cross_sell": False, "shared_data": False,
        "shared_tech": True, "brand_synergy": False,
        "existing_tech": True, "solo_dev": True, "low_regulation": False,
        "mvp_1month": False, "low_dependency": False,
    },
}


def score_all_projects() -> list[OpportunityScore]:
    """기존 MAI 프로젝트 9개를 스코어링한다."""
    results = []
    for name, tags in MAI_PROJECTS.items():
        results.append(score_opportunity(name, tags))
    results.sort(key=lambda x: x.total, reverse=True)
    return results


def format_scores_markdown(scores: list[OpportunityScore]) -> str:
    """스코어링 결과를 마크다운 테이블로 포맷."""
    lines = [
        "| 프로젝트 | 기여 | 수익 | 시너지 | 실현 | 종합 | 사분면 |",
        "|---------|------|------|--------|------|------|--------|",
    ]
    for s in scores:
        lines.append(
            f"| {s.name} | {s.contribution.score:.0f} | {s.revenue.score:.0f} "
            f"| {s.synergy.score:.0f} | {s.feasibility.score:.0f} "
            f"| **{s.total:.1f}** | {s.quadrant} |"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    scores = score_all_projects()
    print(format_scores_markdown(scores))
    print()
    for s in scores:
        print(f"\n### {s.name} — {s.quadrant} (종합 {s.total})")
        for dim, bd in [("기여", s.contribution), ("수익", s.revenue),
                        ("시너지", s.synergy), ("실현", s.feasibility)]:
            print(f"  {dim} ({bd.score:.0f}): {', '.join(bd.reasons)}")
