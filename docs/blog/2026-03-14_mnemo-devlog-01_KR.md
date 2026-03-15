---
title: "Building Mnemo in Public #1 - 온톨로지 품질 70.0에서 95.4까지"
date: 2026-03-14
tags: [mnemo, maisecondbrain, knowledge-graph, obsidian, build-in-public, ontology]
language: ko
channel: tistory
series: building-mnemo-in-public
project: MAISECONDBRAIN
---

# Building Mnemo in Public #1 - 온톨로지 품질 70.0에서 95.4까지

> deterministic metadata normalization, ontology validation, 그리고 trust를 해치지 않는 보수적 resolver까지.

Mnemo는 제 Obsidian 기반 개인 knowledge graph이자 GraphRAG 시스템입니다.

이 프로젝트를 build in public로 공개하는 이유는 단순합니다. 저는 기여와 수익화를 따로 떼어놓고 싶지 않습니다. 실제 진행 상황과 설계 판단, 그리고 trade-off를 꾸준히 공개하면 그게 신뢰가 되고, 그 신뢰가 결국 사용자와 배포, 제품 기회, 수익으로 이어진다고 보기 때문입니다.

이번 #1 글에서는 데모가 더 그럴듯해지는 것보다, **Mnemo가 실제 지식 시스템으로 더 믿을 만해지는 변화**에 집중했습니다.

> 영문 원문은 Substack에서 보실 수 있습니다: https://jinilee.substack.com/p/building-mnemo-in-public-1-from-ontology

## 이번 주에 적용한 것

이번 주 핵심 변화는 세 가지입니다.

### 1) Ontology quality validation

Mnemo의 note ontology에 SHACL 스타일 검증 레이어를 추가했습니다.

이제 frontmatter를 그냥 믿지 않고 아래를 검사합니다.

- 필수 필드 누락
- explicit type 누락
- enum 값 오류
- 날짜 형식 오류
- URL 형식 오류
- supporting context 부족

그래프가 retrieval과 reasoning에 쓰일 거라면, 메타데이터 품질을 선택사항처럼 둘 수는 없다고 생각합니다.

### 2) Deterministic metadata normalization

결정론적(normalization) 패스를 추가했습니다.

제가 중요하게 본 기준은 하나입니다. Mnemo가 vault에 구조를 억지로 환각시키지 말아야 한다는 것. confidence가 충분히 높을 때만 메타데이터를 채우거나 재작성하도록 했습니다.

예를 들면 이런 정규화가 포함됩니다.

- type canonicalization
- missing type backfill
- event_date normalization
- source_type normalization
- tool category normalization
- status normalization
- confidence normalization
- 본문에서 신호가 명확할 때만 URL 추출

### 3) LINEAGE view

backend API와 Obsidian plugin 양쪽에 걸쳐 제대로 된 LINEAGE 기능을 구현했습니다.

Mnemo에서 LINEAGE는 단순한 graph connectivity가 아닙니다. provenance, dependency, outcome을 보여주는 좁고 실용적인 view입니다.

정책상 현재 포함하는 relation은 아래 여섯 가지뿐입니다.

- source
- derived_from
- uses
- used_in
- applied_to
- decisions

반대로 이런 noisy edge는 의도적으로 제외했습니다.

- wiki_link
- related
- supports
- contradicts
- alternatives
- participants
- organization
- tag_shared

LINEAGE는 넓은 그래프보다 **질문에 답하는 그래프**여야 한다고 생각합니다.

## 실제 결과

정규화 패스 이후 ontology quality는 **70.0 → 95.4**로 개선됐습니다.

실제 vault 실행 기준으로 보면:

- passed nodes: **14 → 3346**
- warnings: **8187 → 679**
- errors: **7 → 7**

backend test와 plugin build도 함께 검증했습니다.

## 제가 중요하게 본 설계 판단

resolver를 더 보수적으로 바꿨습니다.

bare-name query가 ambiguous하면 Mnemo는 억지로 맞추지 않아야 합니다. 결과가 없다고 말하거나, 사용자가 직접 구분할 수 있도록 disambiguation을 요구하는 편이 낫습니다. plugin에서도 이제 candidate picker UI를 통해 조용한 오매칭 대신 명시적인 선택 흐름으로 넘기게 했습니다.

개인 knowledge system에서는 no result보다 wrong result가 더 위험할 때가 많습니다. 조용히 신뢰를 깨뜨리기 때문입니다.

## 왜 이 변화가 중요한가

지식도구는 스크린샷에서는 마법처럼 보일 수 있습니다. 하지만 일상 사용에서 버티게 만드는 건 flashy graph가 아니라, 시간이 지나도 의미가 무너지지 않는 semantics입니다.

그래서 저는 아래를 더 중요하게 봅니다.

- clever guessing보다 deterministic normalization
- vague relatedness보다 provenance
- aggressive fuzzy matching보다 conservative resolution
- accidental structure보다 explicit ontology

## 기여와 수익화는 따로 움직이지 않습니다

Mnemo를 public하게 계속 만드는 이유도 여기 있습니다.

- 먼저 유용한 아이디어와 도구를 기여하고
- 그 설계 판단을 기록하고
- 공개적으로 신뢰를 쌓고
- 그 신뢰를 제품 도입, plugin 설치, consulting, 유료 레이어로 연결하기

저에게 기여는 charity가 아니고, 수익화는 기여의 반대편도 아닙니다. 둘이 서로를 강화하는 구조가 가장 강하다고 생각합니다.

## 다음에 할 일

다음으로는 아래를 더 밀어볼 생각입니다.

- ambiguous note name에 대한 candidate disambiguation 강화
- path alias resolution 정리
- cached graph behavior 설명 개선
- FastAPI startup 정리 (lifespan handler 기준)

Obsidian, GraphRAG, personal knowledge system을 만들고 계신다면 같이 비교해보고 싶습니다.

GitHub: https://github.com/jini92/MAISECONDBRAIN
PyPI: https://pypi.org/project/mnemo-secondbrain/
