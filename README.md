# MAISECONDBRAIN (Mnemo)

> 🧠 개인화 세컨드브레인 — 온톨로지 지식그래프 + GraphRAG + Obsidian + OpenClaw

## 개요

개인의 지식과 경험을 **온톨로지 기반 지식그래프**로 구조화하고, **GraphRAG**로 맥락적 검색·추론을 수행하는 개인화 AI 세컨드브레인 시스템.

### 핵심 컨셉

| 레이어 | 기술 | 역할 |
|--------|------|------|
| **데이터 레이크 + 지식그래프** | Obsidian (Markdown + YAML + `[[링크]]`) | 지식 저장·편집·시각화·관계 정의 |
| **그래프 엔진** | NetworkX (인메모리) | 볼트에서 동적 그래프 빌드·탐색 |
| **맥락 검색** | GraphRAG (벡터 + 그래프 하이브리드) | 그래프 기반 검색 증강 생성 |
| **AI 에이전트** | OpenClaw (MAIBOT) | 자동 수집·분석·복습·브리핑 |

### 브랜드: **Mnemo** (므네모)

그리스 신화의 기억의 여신 **Mnemosyne**에서 착안.
"기억을 넘어서, 이해로" — 단순 저장이 아닌 지식의 구조화와 맥락적 활용.

## 기능 로드맵

### Phase 1: 지식 수집 파이프라인
- RSS/웹 클리핑 자동 수집 → Obsidian 노트 변환
- YouTube 영상 요약 + 타임스탬프 추출
- NotebookLM 연동 리서치 워크플로우

### Phase 2: 온톨로지 그래프 구축
- Obsidian `[[위키링크]]` + Property/YAML 기반 엔티티·관계 자동 추출
- 개인 온톨로지 스키마 정의 (Person, Concept, Project, Tool, Insight...)
- NetworkX 인메모리 그래프 동적 빌드 (Obsidian 볼트 = source of truth)

### Phase 3: GraphRAG 검색 엔진
- 벡터 임베딩 + 그래프 관계 탐색 하이브리드 검색
- 질문 → 관련 노드 탐색 → 멀티홉 추론 → 답변 생성
- Obsidian 플러그인으로 인라인 질의 UI

### Phase 4: AI 에이전트 자동화
- 망각 곡선 기반 지식 복습 에이전트
- 일일 오디오 브리핑 생성 (TTS)
- 신규 지식 ↔ 기존 지식 자동 연결 제안
- 인사이트 발견 알림 (크론)

## 기술 스택

- **지식 저장 + 그래프**: Obsidian (Markdown + YAML frontmatter + `[[위키링크]]`) — 별도 DB 없이 볼트 자체가 지식그래프
- **그래프 엔진**: NetworkX (Python 인메모리) — 볼트에서 동적 빌드, 별도 DB 서버 불필요
- **임베딩**: OpenAI/로컬 모델 (벡터 + 그래프 하이브리드)
- **GraphRAG**: Microsoft GraphRAG / LightRAG / 커스텀
- **AI 에이전트**: OpenClaw (MAIBOT) — 크론, 수집, 분석
- **TTS**: OpenClaw TTS / Gemini
- **언어**: Python (그래프/RAG) + TypeScript (Obsidian 플러그인)

## 수익화 모델

1. **SaaS**: Mnemo Cloud — 호스팅 GraphRAG + 옵시디언 싱크
2. **플러그인**: Obsidian 커뮤니티 플러그인 (프리미엄 기능)
3. **API**: 기업용 개인화 지식그래프 API
4. **교육**: "AI 세컨드브레인 구축" 온라인 코스
5. **컨설팅**: 기업 지식 관리 시스템 구축

## 시작하기

### 환경변수 설정

| 변수 | 설명 | 예시 |
|------|------|------|
| `MNEMO_VAULT_PATH` | Obsidian 볼트 경로 | `~/Documents/MyVault` |
| `MNEMO_MEMORY_PATH` | MAIBOT 메모리 경로 | `~/maibot/memory` |
| `MAIBOT_ROOT` | MAIBOT 루트 디렉토리 | `~/maibot` |
| `OPENAI_API_KEY` | OpenAI API 키 | `sk-...` |

```bash
# 1. 환경변수 설정
export MNEMO_VAULT_PATH="$HOME/Documents/MyVault"
export MNEMO_MEMORY_PATH="$HOME/maibot/memory"
export MAIBOT_ROOT="$HOME/maibot"

# 2. 의존성 설치
cd MAISECONDBRAIN
pip install -e .

# 3. 초기 그래프 빌드
python scripts/analyze_vault.py
```

---

*Created: 2026-02-20 by MAIBOT*
