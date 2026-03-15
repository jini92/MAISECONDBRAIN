---
title: "Building Mnemo in Public #2 - LINEAGE를 시끄럽지 않고 유용하게 만들기"
date: 2026-03-14
tags: [mnemo, maisecondbrain, knowledge-graph, obsidian, build-in-public, lineage]
language: ko
channel: tistory
series: building-mnemo-in-public
project: MAISECONDBRAIN
---

# Building Mnemo in Public #2 - LINEAGE를 시끄럽지 않고 유용하게 만들기

> provenance에 집중한 edge 필터링, 보수적 resolver, 그리고 candidate disambiguation까지.

이번 Mnemo devlog #2는 "그래프가 많아 보이는 것"과 "그래프가 실제로 설명력을 가지는 것"은 전혀 다르다는 문제에서 출발했습니다.

지식그래프 도구는 연결을 많이 보여줄수록 그럴듯해 보입니다. 하지만 모든 edge를 한 화면에 섞어 넣으면, 결과는 풍부함이 아니라 소음이 됩니다. 보기에는 복잡한데 정작 중요한 질문에는 답하지 못하는 그래프가 되는 거죠.

그래서 이번에는 Mnemo의 LINEAGE를 generic graph view가 아니라, 더 좁고 더 실용적인 의미로 다시 정의했습니다.

Mnemo에서 LINEAGE는 이제 딱 세 가지를 보여줘야 합니다.

- 어디에서 왔는가
- 무엇에 의존했는가
- 무엇으로 이어졌는가

즉, provenance / dependency / outcome만 남기고 나머지 잡음을 과감하게 걷어냈습니다.

> 영문 대응 글은 아직 실제 발행 URL을 확인하지 못했습니다. 발행되면 여기에 링크를 추가할 예정입니다.

## 이번에 바꾼 것

이번 작업은 backend와 Obsidian plugin 양쪽에 걸쳐 진행했습니다.

핵심 변경은 네 가지입니다.

1. lineage를 generic graph browsing이 아니라 **명시적 semantic contract**로 정의했습니다.
2. lineage에 포함되는 edge를 provenance / dependency / outcome relation으로 제한했습니다.
3. bare-name resolver를 더 보수적으로 바꿔서 애매한 매칭이 조용히 통과하지 않도록 했습니다.
4. ambiguous lookup에 대해서는 candidate disambiguation 흐름을 추가했습니다.

## 왜 이게 중요한가

lineage view는 방향성이 있는 질문에 답해야 합니다.

- 이 노트나 엔티티는 어디서 왔는가?
- 무엇이 이것에 영향을 주었는가?
- 이것은 무엇을 만들어냈는가?
- 어디에 적용되었는가?

반대로 lineage가 해주면 안 되는 일도 분명합니다.

- full graph mode를 대신하는 것
- 단순 `related` 탐색
- 태그 유사성 탐색
- 평범한 `wiki_link` 순회

저는 vague association을 많이 보여주는 큰 그래프보다, 인과와 흐름을 설명하는 작은 그래프가 훨씬 가치 있다고 생각합니다.

## semantic contract를 명확히 했습니다

이번에 lineage semantics 문서를 따로 만들었습니다.

핵심 규칙은 한 줄입니다.

> canonical lineage edge = upstream -> downstream

이 규칙이 생기면 저장 구조와 표현 구조를 분리할 수 있습니다. 내부 raw graph는 유연하게 유지하되, lineage view는 항상 예측 가능하게 동작합니다.

현재 Mnemo LINEAGE에 포함되는 relation은 다음 여섯 가지뿐입니다.

- `source`
- `derived_from`
- `uses`
- `used_in`
- `applied_to`
- `decisions`

반대로 다음 관계는 lineage에서 의도적으로 제외했습니다.

- `related`
- `supports`
- `contradicts`
- `alternatives`
- `participants`
- `organization`
- `tag_shared`
- `wiki_link`

이 차이가 중요합니다.

그냥 그래프를 보여주는 것과 provenance graph를 보여주는 것은 완전히 다른 일입니다.

## 왜 generic relation을 뺐는가

여기에는 꽤 분명한 설계 의견이 들어가 있습니다.

예를 들어 `supports`는 reasoning에는 유용할 수 있습니다. 하지만 그 relation이 답하는 질문은 "무엇이 이 주장을 강화하는가?"이지, "이것이 어디서 왔는가?"는 아닙니다.

`related`와 `tag_shared`도 full graph mode에서는 의미가 있습니다. 하지만 lineage에서는 이런 edge가 많아질수록 설명력보다 밀도만 늘어납니다.

그래서 두 모드를 분리했습니다.

- full graph mode는 넓게 유지
- lineage mode는 좁게 유지

둘이 같은 모양으로 보이면, 둘 중 하나는 자기 역할을 못 하고 있는 겁니다.

## plugin 쪽에서도 lineage role을 드러냈습니다

plugin에서도 lineage를 단순한 색상 변화 정도로 끝내고 싶지 않았습니다.

그래서 현재는 lineage role이 보이도록 정리했습니다.

- current node = 현재 초점
- upstream = 입력 / 조상 / 근거
- downstream = 결과 / 적용 대상
- bridge = 흐름 중간에 있는 매개 노드

그리고 entity type의 의미와 lineage role의 의미가 서로 덮어쓰지 않도록 표현도 다듬었습니다. 중요한 건 그래프가 "질문에 답하게 만드는 것"이지, 그냥 복잡해 보이게 만드는 게 아니니까요.

## resolver는 더 보수적으로 바꿨습니다

제가 이번에 특히 신경 쓴 부분은 resolver입니다.

개인 지식 시스템에서는 애매한 이름을 억지로 맞춘 뒤 자신 있게 보여주는 것이, 차라리 모른다고 말하는 것보다 더 위험합니다.

그래서 Mnemo의 bare-name resolver를 더 보수적으로 조정했습니다.

- 약한 fuzzy match는 쉽게 통과하지 않게 하고
- exact semantic match를 우선하고
- 짧고 약한 contains 매칭은 confidence처럼 다루지 않게 했습니다.

개인 knowledge system에서 trust는 정답률만으로 생기지 않습니다. **틀렸을 때 얼마나 솔직한가**도 중요합니다.

## candidate disambiguation도 추가했습니다

resolver를 더 엄격하게 만들면, 그 다음에는 ambiguity를 다루는 UX가 필요합니다.

그래서 lineage lookup이 ambiguous할 때 Mnemo는 이제 구조화된 candidate 목록을 돌려줄 수 있습니다.

예를 들어 후보에 대해 이런 정보를 같이 제공합니다.

- id
- name
- path
- entity type
- match kind
- score

그리고 plugin에서는 이 ambiguous 상태를 그냥 실패로 끝내지 않고, Obsidian picker에서 바로 후보를 고를 수 있도록 바꿨습니다.

이건 스크린샷으로 봤을 때 가장 화려한 기능은 아닙니다. 하지만 실제 사용성에서는 이런 부분이 시스템의 신뢰도를 결정합니다.

## 기술적으로 무엇이 들어갔는가

이번 lineage pass에는 다음이 포함됐습니다.

- lineage semantics spec 추가
- backend lineage policy 정렬
- stricter ambiguity handling API 반영
- candidate ranking + candidate list generation
- ambiguous lineage selection용 Obsidian picker UI
- graph legend 및 role 표현 정리

그리고 이 semantics를 다듬는 동안 backend test와 plugin build도 함께 검증했습니다.

## 이번 작업에서 더 중요했던 교훈

많은 AI/지식도구는 scope를 넓히는 방향으로 개선하려고 합니다.

- 더 많은 edge
- 더 많은 similarity
- 더 많은 retrieval
- 더 많은 graph

하지만 제가 점점 확신하게 되는 건, product trust는 오히려 반대 방향에서 생길 때가 많다는 점입니다.

**이 view가 무엇을 의미하지 않는지**를 명확히 정하는 것.

Mnemo의 LINEAGE는 universal graph mode를 포기했기 때문에 오히려 더 쓸모 있어졌습니다.

작아져서가 아니라, 의미가 선명해졌기 때문입니다.

## 왜 Mnemo에 중요한가

Mnemo는 단순히 graph demo가 되면 안 됩니다.

제가 원하는 것은 notes, projects, events, tools, ideas 사이에서 아래를 실제로 이해할 수 있게 만드는 것입니다.

- provenance
- transformation
- dependency
- application
- decision flow

그래서 모든 graph mode는 자기 contract를 가져야 합니다.

무엇을 보여주는지, 왜 이 edge가 여기에 있는지 설명하지 못하는 기능은 아직 준비가 끝난 기능이 아닙니다.

## 다음에 할 일

다음에는 이런 것들을 더 밀어볼 생각입니다.

- lineage-aware retrieval surface 강화
- unresolved node 처리 개선
- 사용자가 "왜 이 edge가 포함됐는지" 더 명확히 이해하도록 설명 보강
- lineage debugging과 실제 product workflow 연결 강화

저는 이 방향이 Mnemo에 맞다고 생각합니다.

모든 것을 보여주는 그래프가 아니라,
**어떻게 어떤 것이 다른 것으로 이어지는지 설명하는 그래프**.

GitHub: https://github.com/jini92/MAISECONDBRAIN
PyPI: https://pypi.org/project/mnemo-secondbrain/
