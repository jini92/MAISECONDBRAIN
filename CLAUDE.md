# MAISECONDBRAIN (Mnemo / 므네모)

Obsidian 볼트를 개인화 지식그래프로 변환하는 GraphRAG 기반 세컨드브레인 시스템.  
Python 백엔드 + TypeScript Obsidian 플러그인으로 구성된 하이브리드 지식 탐색 엔진.

---

## 멀티에이전트 코딩

**MAIBOT (오케스트레이터)** → **Claude Code CLI (서브에이전트)**

```
지니님 (Discord)
    ↓
MAIBOT (OpenClaw, Opus) ← 오케스트레이터
    ├── 단순 작업 (설정, 문서, 편집) → MAIBOT 직접 처리
    ├── 중간 작업 (구현, 버그수정, 테스트) → Claude Code Sonnet
    │     claude -p --model sonnet 'task' (workdir: C:\TEST\MAISECONDBRAIN)
    └── 복잡한 작업 (설계, 그래프 알고리즘, 리팩토링) → Claude Code Opus
          claude -p --model opus 'task' (workdir: C:\TEST\MAISECONDBRAIN)
```

**태스크 라우팅:**

| 작업 유형 | 실행 위치 | 모델 |
|---|---|---|
| 설정 변경, 문서 수정 | MAIBOT 직접 | Opus |
| API 엔드포인트, 검색 구현 | Claude Code CLI | Sonnet |
| 그래프 알고리즘, 임베딩 파이프라인 | Claude Code CLI | Opus |
| 온톨로지 설계, 아키텍처 변경 | Claude Code CLI | Opus |

---

## 기술 스택

| 영역 | 기술 | 용도 |
|---|---|---|
| 언어 | Python 3.10+ | 백엔드 전반 |
| 패키지 관리 | pyproject.toml (setuptools) | 빌드/의존성 |
| 그래프 | NetworkX 3.0+ | 지식그래프 구축/탐색 |
| 벡터 검색 | OpenAI embeddings / sentence-transformers | 시맨틱 검색 |
| API 서버 | FastAPI + uvicorn | REST API |
| CLI | Click 8.0+ | 커맨드라인 인터페이스 |
| 테스트 | pytest + pytest-cov | 단위/통합 테스트 |
| Obsidian 플러그인 | TypeScript + esbuild | Obsidian UI 통합 |
| PyPI 패키지명 | mnemo-secondbrain | 배포 |

---

## 프로젝트 구조

```
MAISECONDBRAIN/
├── src/
│   └── mnemo/                    # 메인 Python 패키지
│       ├── __init__.py
│       ├── api.py                # FastAPI 앱 정의
│       ├── cli.py                # Click CLI (mnemo, mnemo-server)
│       ├── graph_builder.py      # 지식그래프 구축
│       ├── graph_search.py       # 그래프 기반 탐색
│       ├── vector_search.py      # 벡터 유사도 검색
│       ├── hybrid_search.py      # 하이브리드 검색 (그래프 + 벡터)
│       ├── embedder.py           # OpenAI / sbert 임베딩
│       ├── parser.py             # Obsidian Markdown 파싱
│       ├── graphrag.py           # GraphRAG 파이프라인
│       ├── ontology.py           # 온톨로지 정의
│       ├── enricher.py           # 노드 강화/보강
│       ├── reranker.py           # 검색 결과 재순위
│       ├── query_classifier.py   # 쿼리 분류
│       ├── opportunity_scorer.py # 기회 스코어링
│       ├── content_linker.py     # 콘텐츠 링크 생성
│       ├── cache.py              # 캐싱 레이어
│       └── collectors/           # 외부 지식 수집
│           ├── web_collector.py
│           ├── knowledge_pipeline.py
│           └── trust_evaluator.py
├── obsidian-plugin/              # Obsidian 플러그인 (TypeScript)
│   ├── src/                      # 플러그인 소스
│   ├── main.js                   # 빌드 결과물
│   ├── manifest.json             # 플러그인 메타데이터
│   └── package.json
├── scripts/                      # 유틸리티 스크립트
│   ├── embed_vault.py            # 볼트 임베딩 생성
│   ├── daily_enrich.py           # 일일 그래프 강화
│   ├── search.py                 # 검색 테스트
│   └── ...
├── docs/                         # 설계 문서
├── .mnemo/                       # 런타임 데이터 (git 무시)
│   ├── graph.pkl                 # 직렬화된 그래프
│   ├── embeddings/               # 벡터 인덱스
│   └── checksums.json
├── pyproject.toml                # 패키지 설정 (Python 3.10+)
├── config.example.yaml           # 설정 예시
├── start-mnemo-api.ps1           # Windows API 서버 시작 스크립트
└── CLAUDE.md
```

---

## 핵심 규칙

### 그래프/임베딩 데이터 관리
- `.mnemo/` 디렉토리는 **런타임 캐시** — git에 커밋하지 말 것
- `graph.pkl`은 NetworkX 직렬화 파일 — 스키마 변경 시 재생성 필요
- 임베딩 모델 변경 시 전체 `embeddings/` 폴더 삭제 후 재임베딩

### API 서버 (FastAPI)
- 포트: 기본 `8765` (config.yaml에서 변경 가능)
- Obsidian 플러그인 ↔ API 간 로컬 통신 전제
- CORS는 `localhost`만 허용 (외부 노출 금지)

### Obsidian 플러그인
- `obsidian-plugin/` 빌드는 별도 (`npm run build`)
- 빌드 결과물 `main.js`는 git 추적 (Obsidian 커뮤니티 플러그인 배포용)
- Obsidian API 버전: `manifest.json`의 `minAppVersion` 참조

### PyPI 배포
- 패키지명: `mnemo-secondbrain` (import는 `mnemo`)
- 버전 관리: `pyproject.toml`의 `version` 필드 단독 관리
- 빌드 전 반드시 테스트 통과 확인

### 볼트 경로
- 실제 Obsidian 볼트: `C:\Users\jini9\OneDrive\Documents\JINI_SYNC`
- 테스트용 샘플 볼트와 실제 볼트 혼용 금지
- 볼트 경로는 `config.yaml`에서 설정, 코드에 하드코딩 금지

---

## 개발 명령어

### Python 환경 설정

```bash
# 가상환경 생성 (최초 1회)
python -m venv .venv
.venv\Scripts\activate  # Windows

# 의존성 설치 (전체)
pip install -e ".[all,dev]"

# 기본만 설치
pip install -e ".[dev]"
```

### CLI 실행

```bash
# 볼트 인덱싱
mnemo index <vault-path>

# 검색
mnemo search "쿼리"

# 그래프 통계
mnemo stats

# API 서버 시작
mnemo-server --port 8765

# Windows 스크립트로 서버 시작
.\start-mnemo-api.ps1
```

### 테스트

```bash
# 전체 테스트
pytest

# 커버리지 포함
pytest --cov=mnemo --cov-report=term-missing

# 특정 모듈 테스트
pytest tests/test_graph_builder.py -v
```

### 빌드 (PyPI 배포)

```bash
# 패키지 빌드
python -m build

# 테스트 PyPI 업로드
twine upload --repository testpypi dist/*

# 실제 PyPI 업로드
twine upload dist/*
```

### Obsidian 플러그인 빌드

```bash
cd obsidian-plugin

# 의존성 설치
npm install

# 개발 빌드 (watch)
npm run dev

# 프로덕션 빌드
npm run build
```

### 스크립트 유틸리티

```bash
# 볼트 임베딩 생성
python scripts/embed_vault.py --vault <path>

# 일일 강화
python scripts/daily_enrich.py

# 검색 테스트
python scripts/search.py "쿼리 텍스트"
```

---

## 코딩 스타일

### Python
- **타입 힌트 필수**: 모든 함수 시그니처에 타입 힌트 작성
- **Docstring**: 공개 함수/클래스에 Google 스타일 docstring
- **포매터**: black + isort (라인 길이 100)
- **린터**: flake8 / ruff
- 비동기: FastAPI 엔드포인트는 `async def` 사용
- 예외 처리: 구체적인 예외 타입 지정, 광범위한 `except Exception` 지양

### TypeScript (Obsidian 플러그인)
- **strict 모드** 활성화 (`tsconfig.json`)
- Obsidian API 타입 엄격하게 사용 (`obsidian` 패키지 타입)
- `any` 타입 사용 금지

### 공통
- 커밋 메시지: `feat:`, `fix:`, `refactor:`, `docs:` 등 Conventional Commits
- 한 커밋에 하나의 논리적 변경만 포함
- `.mnemo/`, `__pycache__/`, `*.egg-info/`, `dist/` → `.gitignore` 유지
