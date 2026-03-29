---
title: "Building Mnemo in Public #3 - memory를 operational layer와 reasoning layer로 분리한 이유"
date: 2026-03-27
tags: [mnemo, maisecondbrain, knowledge-graph, graphrag, obsidian, build-in-public, memory]
language: ko
channel: tistory
series: building-mnemo-in-public
project: MAISECONDBRAIN
---

# Building Mnemo in Public #3 - memory를 operational layer와 reasoning layer로 분리한 이유

> 이번 주에 저는 memory를 하나의 큰 저장통처럼 다루는 방식을 버렸습니다. MAIJINI는 이제 action-changing 사실만 담는 작은 operational memory와, 긴 문맥·관계·크로스 프로젝트 회상을 맡는 Mnemo reasoning layer를 의도적으로 분리해 사용합니다.

AI assistant가 망가지는 방식은 의외로 화려하지 않습니다.

모델이 약해서가 아니라, memory가 지저분해져서 무너지는 경우가 많습니다.

한 레이어에 전부 넣기 시작하면 금방 문제가 생깁니다.

- preferences
- 임시 상태
- 회의 메모
- 리서치 조각
- 실험 로그
- 관계 문맥
- 덜 익은 아이디어

겉으로는 풍부해 보이지만, 실제 운영에서는 점점 나빠집니다.
assistant는 지금 행동을 바꿔야 하는 정보를 더 느리게 찾고, stale detail을 잘못 꺼내고, 무엇이 정말로 현재 동작을 바꾸는 사실인지 흐리게 만듭니다.

이번 주에 이 분리를 finally 명시했습니다.

## 이번에 고정한 결정

MAIJINI는 이제 memory를 의도적으로 두 층으로 나눕니다.

### 1. Operational memory

짧고, 현재 동작을 바꾸는 레이어입니다.

여기에는 이런 것들이 들어갑니다.

- preferences
- durable decisions
- current status
- next actions
- access path
- operating rules

실제로는 `memory/*.md` 레이어가 이 역할을 맡습니다.

핵심은 **작게 유지하는 것**입니다.
그 메모가 assistant의 현재 행동을 바꾸지 않는다면, 여기에 둘 이유가 거의 없습니다.

### 2. Reasoning memory

깊은 문맥과 관계를 다루는 레이어입니다.

여기에는 이런 것들이 들어갑니다.

- 긴 실험 이력
- 회의/논의 문맥
- 크로스 프로젝트 관계
- 배경 리서치
- source-level 자료
- 단순 lookup보다 synthesis가 필요한 지식

제 운영에서는 이 레이어가 Mnemo입니다.
Mnemo는 Obsidian 볼트를 knowledge graph + GraphRAG retrieval 시스템으로 바꿉니다.

그래서 이런 질문을 더 잘 다룰 수 있습니다.

- 왜 이런 결정을 했는가
- 다른 프로젝트에서 비슷한 실패로 뭘 배웠는가
- 여러 initiative를 가로지르는 패턴은 무엇인가
- 어떤 아이디어가 이전에 어디서 등장했고 무엇에 영향을 줬는가

이건 작은 operational memory가 해야 할 일이 아닙니다.
그리고 하나의 저장소가 둘 다 잘 해내길 기대하면 시스템은 금방 noisy해집니다.

## Retrieval order도 함께 바꿨습니다

중요했던 건 저장 위치만이 아닙니다.
retrieval policy도 함께 정리했습니다.

기본 recall 순서는 이제 이렇습니다.

`memory_search -> Mnemo -> web_search`

이 순서는 생각보다 중요합니다.

### 먼저 작은 레이어를 본다

질문이 preference, status, 이미 결정된 운영 원칙에 관한 것이라면 답은 대개 operational layer에 있습니다.
가장 빠르고 안전하게 확인할 수 있는 곳이기도 합니다.

### 확신이 부족할 때만 더 깊이 간다

그걸로 부족하면 두 번째 단계로 Mnemo를 씁니다.
이 레이어는 다음 같은 작업을 맡습니다.

- graph relationship 탐색
- long-tail note 회수
- historical context 복원
- cross-project inference
- source-backed synthesis

### 웹 검색은 마지막

외부 검색은 여전히 유용합니다.
하지만 내부 지식보다 앞에 오면 안 됩니다.
이미 시스템 안에 답이 있는데 assistant가 자기 작업을 잊은 것처럼 행동하는 건 좋지 않습니다.

## 왜 지금 이 변화가 필요했나

이건 이론 정리가 아니었습니다.
실제 operator pain에서 나온 정리였습니다.

최근 며칠 동안 두 가지가 분명해졌습니다.

첫째, 어떤 정보는 작고 durable하게 남아야 했습니다.
예를 들면:

- publishing cadence
- project priority
- channel rule
- memory policy 자체
- 무엇을 진짜 완료로 볼 것인가

둘째, 어떤 질문은 분명히 더 깊은 층이 필요했습니다.
질문이 이런 형태가 되는 순간입니다.

- 여러 프로젝트에서 무엇이 바뀌었는가
- 왜 그런 trade-off를 택했는가
- 실험 전반에서 반복되는 패턴은 무엇인가
- 과거 설계 아이디어의 출처가 무엇이었는가

이건 짧은 운영 메모로는 부족합니다.
이건 Mnemo가 맡아야 하는 문제입니다.

저는 이 둘을 같은 recall로 취급하고 싶지 않았습니다.
실제로도 전혀 다른 종류의 작업이기 때문입니다.

## 같이 드러난 교훈: 영리한 구조보다 stable runtime이 먼저

이번 주엔 또 하나의 boring but important한 교훈이 있었습니다.
memory 혼선 중 일부는 사실 “AI 문제”가 아니라 “시스템 문제”였습니다.

어떤 관점에서는 Mnemo가 unhealthy해 보였는데, 이유는 오래된 mental model이 여전히 `localhost:7890`을 기대한 반면 실제 FastAPI 서비스는 이미 `127.0.0.1:8000`에서 돌고 있었기 때문입니다.

작아 보이지만 운영에서는 꽤 중요합니다.
runtime surface와 operator의 가정이 어긋나면, 코어가 멀쩡해도 memory layer 전체가 unreliable하게 느껴집니다.

그래서 이번 주 작업의 일부는 새 기능 추가가 아니었습니다.
trust를 복구하는 일이었습니다.

- 실제 서버 경로 확인
- retrieval route 검증
- Windows CPU 환경에 맞는 GraphRAG default 조정
- 낡은 가정과 현재 reality를 분리

저는 architecture를 좋아합니다.
하지만 실제 운영자는 결국 예쁜 diagram보다 verified behavior를 더 신뢰합니다.

## 그 아래에 있는 설계 원칙

요즘 더 강하게 느끼는 건 agent memory도 storage system처럼 다뤄야 한다는 점입니다.

**hot state와 deep history는 같은 클래스의 데이터가 아닙니다.**

Operational memory는 hot state입니다.
그래서 다음 특성을 가져야 합니다.

- 짧을 것
- 명시적일 것
- 행동을 바꿀 것
- 업데이트하기 쉬울 것
- 신뢰하기 쉬울 것

Reasoning memory는 deep history입니다.
그래서 다음 특성을 가져야 합니다.

- 넓을 것
- relational할 것
- source-backed일 것
- synthesis 가능할 것
- 커져도 견딜 수 있을 것

정책 없이 둘을 섞으면, agent는 모든 걸 한 가방에 넣고 다니면서 필요한 순간마다 엉뚱한 걸 꺼내게 됩니다.

## 이 분리가 실제로 여는 것

작은 변화지만, 저는 이게 누적된다고 봅니다.

이 분리는 assistant를 더 잘하게 만듭니다.

- 이미 결정된 답은 바로 꺼내기
- 필요할 때만 깊은 recall로 escalate하기
- memory 파일을 operational하게 유지하기
- Mnemo를 dumping ground가 아니라 reasoning layer로 쓰기
- 빠른 경로를 오염시키지 않고 decision history 복원하기

그리고 build-in-public에도 도움이 됩니다.
이제 시스템을 더 정직하게 설명할 수 있기 때문입니다.

- `memory/*.md` = operating memory
- Mnemo = reasoning memory
- web search = external fallback

“거대한 memory 하나가 somehow 다 한다”보다 훨씬 나은 제품 스토리입니다.

## 앞으로 더 다듬고 싶은 것

다음 단계는 화려하진 않지만 중요합니다.

- operational memory를 decision-grade note 중심으로 더 줄이기
- 긴 문맥과 관계 중심 자료를 Mnemo/Obsidian 쪽으로 더 밀어넣기
- runtime default를 실제 배포 경로와 계속 맞추기
- operator가 retrieval boundary를 더 잘 볼 수 있게 만들기

좋은 memory system은 모든 걸 저장해서 인상적인 게 아닙니다.
무엇을 작게 유지해야 하는지, 무엇을 깊게 유지해야 하는지, 언제 그 경계를 넘어야 하는지 아는 시스템이라서 좋습니다.

제가 Mnemo로 만들고 싶은 건 바로 그쪽입니다.

GitHub: https://github.com/jini92/MAISECONDBRAIN
PyPI: https://pypi.org/project/mnemo-secondbrain/

