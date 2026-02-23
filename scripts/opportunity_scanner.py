#!/usr/bin/env python3
"""기회 자동 탐지 + 스코어링 스캐너 — MAI Universe Stage 2 DISCOVER

Usage:
    python scripts/opportunity_scanner.py --top-k 5 --format json
    python scripts/opportunity_scanner.py --score-existing
    python scripts/opportunity_scanner.py --scan --save-obsidian
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.stderr.reconfigure(encoding="utf-8")
from datetime import datetime
from pathlib import Path

# ── 프로젝트 루트를 Python path에 추가 ──
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo.opportunity_scorer import (
    OpportunityScore,
    format_scores_markdown,
    score_all_projects,
    score_opportunity,
)

# ── 설정 ──
_vault_path = os.environ.get("MNEMO_VAULT_PATH")
if not _vault_path:
    print("ERROR: MNEMO_VAULT_PATH environment variable is not set."); sys.exit(1)
VAULT = Path(_vault_path)
EXTERNAL_KNOWLEDGE_DIR = VAULT / "03.RESOURCES" / "외부지식"
DAILY_DIR = VAULT / "00.DAILY"

# 프로젝트 키워드 맵 — 외부 지식과 프로젝트 매칭용
# ⚠️ MEMORY.md의 16개 프로젝트와 동기화 유지할 것
PROJECT_KEYWORDS: dict[str, list[str]] = {
    "MAIBOT": ["AI 에이전트", "봇", "자동화", "LLM", "Discord", "assistant", "agent", "OpenClaw"],
    "MAITCAD": ["CAD", "엔지니어링", "도면", "설계", "3D 모델링", "AutoCAD"],
    "MAIPnID": ["P&ID", "배관", "계장", "도면", "SBOM", "설비", "플랜트"],
    "MAIAX": ["산업", "스마트제조", "디지털트윈", "모니터링", "IoT", "실시간", "발효", "AX"],
    "MAIOSS": ["오픈소스", "보안", "스캐너", "SCA", "SBOM", "취약점", "vulnerability", "CVE", "CRA"],
    "MAITB": ["기술블로그", "콘텐츠", "SEO", "마크다운", "블로그"],
    "MAITHINK": ["세컨드브레인", "지식그래프", "Obsidian", "노트", "RAG", "PKM", "추론"],
    "MAIBEAUTY": ["화장품", "뷰티", "베트남", "K뷰티", "커머스", "숏폼", "화장"],
    "MAISTAR7": ["인력매칭", "채용", "한국기업", "베트남인력", "Zalo", "구인구직"],
    "MAICON": ["로컬서비스", "예약", "베트남", "미용실", "네일", "서비스예약"],
    "MAITUTOR": ["어학교육", "한국어", "베트남어", "TOPIK", "언어학습", "AI튜터"],
    "MAIBOTALKS": ["음성대화", "TTS", "STT", "음성AI", "대화형앱", "OpenClaw"],
    "MAITOK": ["TikTok", "댓글", "감성분석", "대댓글", "소셜커머스", "숏폼"],
    "MAISECONDBRAIN": ["세컨드브레인", "지식그래프", "GraphRAG", "Obsidian", "Mnemo", "온톨로지"],
    "MAIPatent": ["특허", "IP", "지재권", "patent", "발명", "출원"],
    "MAITalkCart": ["대화형커머스", "쇼핑", "AI커머스", "대화주문", "conversational"],
    "MAIUPbit": ["디지털자산", "암호화폐", "거래", "업비트", "비트코인", "투자분석"],
}


def scan_external_knowledge(days: int = 7) -> list[dict]:
    """최근 N일간 외부 지식 파일을 읽고 기회를 탐지한다."""
    if not EXTERNAL_KNOWLEDGE_DIR.exists():
        print(f"[WARN] 외부지식 디렉토리 없음: {EXTERNAL_KNOWLEDGE_DIR}")
        return []

    cutoff = datetime.now().strftime("%Y-%m-%d")  # 오늘까지
    files = sorted(EXTERNAL_KNOWLEDGE_DIR.glob("*.md"), reverse=True)

    opportunities: list[dict] = []
    seen_titles: set[str] = set()

    for f in files[:100]:  # 최대 100개 파일 스캔
        content = f.read_text(encoding="utf-8", errors="replace")
        title = f.stem
        if title in seen_titles:
            continue
        seen_titles.add(title)

        # 프로젝트 연관성 매칭
        matched_projects = []
        for proj, keywords in PROJECT_KEYWORDS.items():
            for kw in keywords:
                if kw.lower() in content.lower() or kw.lower() in title.lower():
                    matched_projects.append(proj)
                    break

        if not matched_projects:
            continue

        # 기회 패턴 탐지
        patterns = detect_opportunity_patterns(title, content, matched_projects)
        if not patterns:
            continue

        # 기회 태그 자동 추론
        tags = infer_tags(content, matched_projects)
        score = score_opportunity(title, tags)

        opportunities.append({
            "title": title,
            "file": str(f.name),
            "matched_projects": matched_projects,
            "patterns": patterns,
            "score": score.to_dict(),
        })

    # 종합 점수순 정렬
    opportunities.sort(key=lambda x: x["score"]["total_score"], reverse=True)
    return opportunities


def detect_opportunity_patterns(
    title: str, content: str, matched_projects: list[str]
) -> list[str]:
    """기회 패턴을 탐지한다."""
    patterns = []
    lower = content.lower()

    # 신기술 적용 기회
    tech_signals = ["새로운", "최신", "트렌드", "혁신", "업데이트", "출시", "발표",
                    "latest", "new", "release", "breakthrough"]
    if any(s in lower for s in tech_signals):
        patterns.append("신기술_적용_가능")

    # 경쟁사 빈틈
    gap_signals = ["부족", "없", "미비", "한계", "문제", "challenge", "gap", "missing"]
    if any(s in lower for s in gap_signals):
        patterns.append("시장_빈틈_발견")

    # 크로스 프로젝트 시너지
    if len(matched_projects) >= 2:
        patterns.append("크로스_프로젝트_시너지")

    # 수익 기회
    revenue_signals = ["수익", "매출", "구독", "SaaS", "과금", "유료", "revenue", "monetize"]
    if any(s in lower for s in revenue_signals):
        patterns.append("수익_기회")

    return patterns


def infer_tags(content: str, matched_projects: list[str]) -> dict:
    """콘텐츠에서 스코어링 태그를 자동 추론한다."""
    lower = content.lower()
    tags = {}

    # 기여도 태그
    tags["open_source"] = any(k in lower for k in ["오픈소스", "open source", "open-source", "github"])
    tags["free_tool"] = any(k in lower for k in ["무료", "free", "플러그인", "plugin"])
    tags["education"] = any(k in lower for k in ["교육", "학습", "튜토리얼", "강의", "education"])
    tags["social_impact"] = any(k in lower for k in ["사회", "공공", "접근성", "social"])
    tags["community"] = any(k in lower for k in ["커뮤니티", "community", "포럼"])

    # 수익 태그
    tags["recurring"] = any(k in lower for k in ["구독", "saas", "월", "subscription", "recurring"])
    tags["high_margin"] = any(k in lower for k in ["마진", "서버비 0", "제로 코스트", "margin"])
    tags["large_tam"] = any(k in lower for k in ["시장", "market", "billion", "$1b", "tam"])
    tags["fast_bep"] = any(k in lower for k in ["빠른", "bep", "break-even", "즉시"])
    tags["multi_channel"] = any(k in lower for k in ["다중", "멀티", "채널", "multi"])

    # 시너지 태그
    tags["shared_infra"] = len(matched_projects) >= 2
    tags["cross_sell"] = len(matched_projects) >= 2
    tags["shared_data"] = any(k in lower for k in ["데이터", "data", "공유"])
    tags["shared_tech"] = any(k in lower for k in ["python", "typescript", "llm", "ai"])
    tags["brand_synergy"] = any(k in lower for k in ["mai", "브랜드"])

    # 실현 가능성 태그
    tags["existing_tech"] = any(k in lower for k in ["python", "javascript", "llm", "gpt", "api"])
    tags["solo_dev"] = True  # MAIBOT 지원이므로 기본 True
    tags["low_regulation"] = not any(k in lower for k in ["규제", "법률", "인허가", "regulation"])
    tags["mvp_1month"] = any(k in lower for k in ["간단", "쉽", "빠른", "simple", "easy", "quick"])
    tags["low_dependency"] = not any(k in lower for k in ["의존", "dependency", "외부 서비스"])

    return tags


def save_obsidian_report(opportunities: list[dict], project_scores: list[OpportunityScore] | None = None) -> Path:
    """Obsidian 노트로 저장."""
    today = datetime.now().strftime("%Y-%m-%d")
    path = DAILY_DIR / f"{today}_Opportunity_Scan.md"
    DAILY_DIR.mkdir(parents=True, exist_ok=True)

    lines = [
        f"# 🔍 기회 탐지 스캔 — {today}",
        "",
        f"> 자동 생성: `opportunity_scanner.py` | 스캔 시간: {datetime.now().strftime('%H:%M')}",
        "",
    ]

    # 기존 프로젝트 스코어링
    if project_scores:
        lines.append("## 📊 기존 프로젝트 스코어링")
        lines.append("")
        lines.append(format_scores_markdown(project_scores))
        lines.append("")

    # 탐지된 기회
    lines.append(f"## 🎯 탐지된 기회 (총 {len(opportunities)}건)")
    lines.append("")

    for i, opp in enumerate(opportunities[:10], 1):
        s = opp["score"]
        lines.append(f"### {i}. {opp['title']}")
        lines.append(f"- **사분면**: {s['quadrant']} | **종합**: {s['total_score']:.1f}")
        lines.append(f"- **연관 프로젝트**: {', '.join(opp['matched_projects'])}")
        lines.append(f"- **패턴**: {', '.join(opp['patterns'])}")
        lines.append(f"- 기여 {s['contribution_score']:.0f} | 수익 {s['revenue_score']:.0f} | 시너지 {s['synergy_score']:.0f} | 실현 {s['feasibility_score']:.0f}")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def format_discord_summary(opportunities: list[dict], top_k: int = 3) -> str:
    """Discord DM용 요약."""
    lines = ["📡 **기회 탐지 결과** (상위 {}건)".format(min(top_k, len(opportunities)))]
    for opp in opportunities[:top_k]:
        s = opp["score"]
        lines.append(
            f"  {s['quadrant']} **{opp['title'][:40]}** "
            f"(종합 {s['total_score']:.1f}) → {', '.join(opp['matched_projects'][:3])}"
        )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="MAI Universe 기회 탐지 스캐너")
    parser.add_argument("--scan", action="store_true", default=True, help="외부 지식 스캔")
    parser.add_argument("--score-existing", action="store_true", help="기존 9개 프로젝트 스코어링")
    parser.add_argument("--top-k", type=int, default=5, help="상위 N개 출력")
    parser.add_argument("--format", choices=["json", "markdown", "discord"], default="markdown")
    parser.add_argument("--save-obsidian", action="store_true", help="Obsidian 노트로 저장")
    parser.add_argument("--days", type=int, default=7, help="최근 N일 스캔")
    args = parser.parse_args()

    project_scores = None
    if args.score_existing:
        project_scores = score_all_projects()
        if args.format == "json":
            print(json.dumps([s.to_dict() for s in project_scores], ensure_ascii=False, indent=2))
        elif args.format == "discord":
            lines = ["📊 **프로젝트 스코어링**"]
            for s in project_scores:
                lines.append(f"  {s.quadrant} **{s.name}** — 종합 {s.total}")
            print("\n".join(lines))
        else:
            print(format_scores_markdown(project_scores))
            print()
            for s in project_scores:
                print(f"### {s.name} — {s.quadrant} (종합 {s.total})")
                for dim, bd in [("기여", s.contribution), ("수익", s.revenue),
                                ("시너지", s.synergy), ("실현", s.feasibility)]:
                    print(f"  {dim} ({bd.score:.0f}): {', '.join(bd.reasons)}")
                print()

        if not args.scan or args.score_existing:
            if args.save_obsidian:
                p = save_obsidian_report([], project_scores)
                print(f"\n✅ Obsidian 저장: {p}")
            return

    # 기회 스캔
    opportunities = scan_external_knowledge(args.days)

    if args.format == "json":
        print(json.dumps(opportunities[:args.top_k], ensure_ascii=False, indent=2))
    elif args.format == "discord":
        print(format_discord_summary(opportunities, args.top_k))
    else:
        print(f"# 🔍 기회 탐지 결과 — 총 {len(opportunities)}건 (상위 {args.top_k}개)\n")
        for i, opp in enumerate(opportunities[:args.top_k], 1):
            s = opp["score"]
            print(f"## {i}. {opp['title']}")
            print(f"  사분면: {s['quadrant']} | 종합: {s['total_score']:.1f}")
            print(f"  연관: {', '.join(opp['matched_projects'])}")
            print(f"  패턴: {', '.join(opp['patterns'])}")
            print()

    if args.save_obsidian:
        p = save_obsidian_report(opportunities[:args.top_k], project_scores)
        print(f"\n✅ Obsidian 저장: {p}")


if __name__ == "__main__":
    main()
