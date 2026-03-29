"""쿼리 타입 자동 분류 + 동적 검색 가중치.

쿼리를 3가지 타입으로 분류하고 각 타입에 최적화된 가중치를 반환:
- factual: 특정 사실/프로젝트/기술 조회 → 키워드 중심
- relational: 관계/연결/인물 탐색 → 그래프 중심
- exploratory: 넓은 탐색/비교/트렌드 → 벡터 중심
"""
from __future__ import annotations

import re

# --- 분류 규칙 ---

# factual 신호: 특정 프로젝트, 기술명, 구현/설정/설치 등
FACTUAL_PATTERNS = [
    r"\b(MAI\w+|MAIBOT|MAIOSS|MAIBEAUTY|MAITOK|MAICON|MAISTAR7|MAITUTOR|MAIBOTALKS|MAISECONDBRAIN|MAIPatent|MAITalkCart|MAITHINK|MAITCAD|MAITB|MAIPnID)\b",
    r"(아키텍처|구현|설정|설치|config|setup|install|구조|스키마|API|endpoint)",
    r"(어떻게|방법|how to|가이드|절차|단계)",
    r"(PRD|SRS|설계서|명세|스펙|specification)",
]

# relational 신호: 연결, 관계, 시너지, 인물, 영향
RELATIONAL_PATTERNS = [
    r"(관련|연결|시너지|연동|통합|영향|impact|relationship)",
    r"(김\w{1,3}|이\w{1,3}|박\w{1,3}|장\w{1,3})\s*(매니저|대표|팀장|과장|부장|사원)?",
    r"(누가|어디서|with|관련된|참여|참석|미팅에서|회의에서)",
    r"(사이|between|연관|cross|크로스)",
    r"\b(Sam Altman|Jensen Huang)\b",
]

# exploratory 신호: 넓은 비교, 트렌드, 전략, 동향
EXPLORATORY_PATTERNS = [
    r"(비교|차이|vs|versus|대비|장단점|pros|cons)",
    r"(트렌드|동향|전망|기회|리스크|시장|market)",
    r"(전략|모델|방안|아이디어|브레인스토밍|가능성)",
    r"(최근|최신|latest|새로운|emerging|떠오르는)",
    r"(왜|why|이유|근거|배경|motivation)",
]

# 가중치: (keyword_weight, vector_weight, graph_weight)
# A/B 테스트 (2026-02-24) 결과 반영: 기본 대비 미세 조정만 적용
# 공격적 변동은 관련도를 오히려 떨어뜨림 (baseline 0.521 → aggressive dynamic 0.396)
WEIGHT_MAP = {
    "factual":     (0.52, 0.30, 0.18),  # 키워드 약간 강화
    "relational":  (0.40, 0.25, 0.35),  # 그래프 약간 강화 (baseline에서 크게 안 벗어남)
    "exploratory": (0.40, 0.40, 0.20),  # 벡터 약간 강화
}

DEFAULT_WEIGHTS = (0.50, 0.30, 0.20)


def _count_matches(text: str, patterns: list[str]) -> int:
    count = 0
    for pat in patterns:
        if re.search(pat, text, re.IGNORECASE):
            count += 1
    return count


def classify_query(query: str) -> str:
    """쿼리 타입 분류: factual / relational / exploratory"""
    scores = {
        "factual": _count_matches(query, FACTUAL_PATTERNS),
        "relational": _count_matches(query, RELATIONAL_PATTERNS),
        "exploratory": _count_matches(query, EXPLORATORY_PATTERNS),
    }

    # tie-break: factual > relational > exploratory
    max_score = max(scores.values())
    if max_score == 0:
        return "factual"  # default

    for qtype in ("factual", "relational", "exploratory"):
        if scores[qtype] == max_score:
            return qtype

    return "factual"


def get_weights(query_type: str) -> tuple[float, float, float]:
    """쿼리 타입에 맞는 (keyword, vector, graph) 가중치 반환."""
    return WEIGHT_MAP.get(query_type, DEFAULT_WEIGHTS)


def classify_and_weight(query: str) -> tuple[str, float, float, float]:
    """쿼리 분류 + 가중치를 한 번에 반환.

    Returns:
        (query_type, keyword_weight, vector_weight, graph_weight)
    """
    qtype = classify_query(query)
    kw, vw, gw = get_weights(qtype)
    return qtype, kw, vw, gw
