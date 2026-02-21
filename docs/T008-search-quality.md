# T008: Search Quality Benchmark

Date: 2026-02-21

Notes in vault: 3199


## Results


### Query: `베트남 화장품 사업`


**default (all-MiniLM-L6-v2)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.6831 |
| 2 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.6831 |
| 3 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.6831 |
| 4 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.6831 |
| 5 | 사업계획서-마이에이전시 | 0.5384 |

**korean (ko-sroberta-multitask)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 2026-02-20_C_베트남 뷰티 시장 동향 | 0.6779 |
| 2 | 2026-02-21_C_베트남 뷰티 시장 동향 | 0.6719 |
| 3 | 베트남 화장품사업 | 0.6520 |
| 4 | 2026-02-20_Business_Intelligence | 0.6414 |
| 5 | STATUS-Development-Overview-JINI_HOME_PC | 0.6344 |

**korean + reranker**:

| # | Note | Rerank Score |
|---|------|-------------|
| 1 | 베트남 화장품사업 | 8.5760 |
| 2 | 2024-11-15_베트남 법인 설립 미팅 | 8.4342 |
| 3 | 베트남-세일즈-전략 | 8.3607 |
| 4 | 2026-01-30_ [AI 기반 베트남 뷰티 세일즈 오토메이션] 방안 | 8.2984 |
| 5 | 2025-07-07_베트남 제작 기반 1인 웨딩드레스 사업 완벽 가이드_한국·베트남 동시  | 8.2728 |

### Query: `knowledge graph 구축`


**default (all-MiniLM-L6-v2)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 2026-02-20_C_개인 지식그래프 RAG | 0.6661 |
| 2 | _MASTER_DASHBOARD | 0.6225 |
| 3 | Dashboard | 0.5995 |
| 4 | 2026-02-21_C_개인 지식그래프 RAG | 0.5964 |
| 5 | 2025-07-18_C&E 자동화 시스템_개발현황_GraphRAG_update_프롬프트_D | 0.5105 |

**korean (ko-sroberta-multitask)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 2026-02-21_C_개인 지식그래프 RAG | 0.6149 |
| 2 | 2026-02-20_C_개인 지식그래프 RAG | 0.6099 |
| 3 | Dashboard | 0.5973 |
| 4 | 2025-06-04_MAIPnIDPOC_전체 P&ID 인식률 고도화 파이프라인 매뉴얼 | 0.5901 |
| 5 | 2025-01-02_RAG 개념 | 0.5645 |

**korean + reranker**:

| # | Note | Rerank Score |
|---|------|-------------|
| 1 | 2026-02-21_C_개인 지식그래프 RAG | 6.8618 |
| 2 | 2026-02-20_C_개인 지식그래프 RAG | 6.4668 |
| 3 | _MASTER_DASHBOARD | 5.3286 |
| 4 | Dashboard | 5.0906 |
| 5 | 2026-02-21_MAIBOT_Session | 4.9175 |

### Query: `AI 수익화 전략`


**default (all-MiniLM-L6-v2)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 심사 업무 영역 검증 | 0.5864 |
| 2 | 심사 업무 영역 검증 | 0.5864 |
| 3 | 심사 업무 영역 검증 | 0.5864 |
| 4 | Cardok AI PoC 아키텍쳐 | 0.5797 |
| 5 | Cardok AI PoC 아키텍쳐 | 0.5797 |

**korean (ko-sroberta-multitask)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 2025-07-05_AI 활용 개발 부서 세팅 전략_수익화 구조 | 0.7281 |
| 2 | 2026-01-17_Google OPAL vs. n8n_AI 비즈니스 비교 및 심층 수익화 | 0.7215 |
| 3 | 2026-02-21_C_AI 수익화 전략 | 0.7154 |
| 4 | 2026-02-12_Daily AI Monetization Briefing | 0.7018 |
| 5 | 2025-02-14_Quantium_ 심층분석_비지니스모델 | 0.6984 |

**korean + reranker**:

| # | Note | Rerank Score |
|---|------|-------------|
| 1 | 2025-01-07_IBK 기업은행 AI 서비스 수익화 모델 | 8.0326 |
| 2 | 2024-12-20_소규모 AI Agent Service 제안서 | 7.9373 |
| 3 | 2025-01-02_RAG 특화 AI 개발 제안서 | 7.9244 |
| 4 | 2025-01-06_가공 매뉴얼 중심의 검색형 AI 구축 방법과 수익화 | 7.8904 |
| 5 | 2024-12-20_소규모 AI Agent Service 사업계획서 | 7.7964 |

### Query: `오픈소스 보안 스캐너`


**default (all-MiniLM-L6-v2)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.7805 |
| 2 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.7805 |
| 3 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.7805 |
| 4 | 통합 솔루션 시나리오-오픈소스 취약성 검토 | 0.7805 |
| 5 | 통합솔루션-스캔코드 | 0.6262 |

**korean (ko-sroberta-multitask)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 2026-02-20_B_오픈소스 보안 스캐너 최신 동향 | 0.7173 |
| 2 | 2026-02-21_C_오픈소스 보안 스캐너 최신 동향 | 0.6917 |
| 3 | 2024-12-28_MAIOSS 오픈소스 보안 취약점 검증 솔루션_웹스크립트 | 0.6908 |
| 4 | 2026-02-20_C_오픈소스 보안 스캐너 최신 동향 | 0.6720 |
| 5 | I-02_Security_Scanner_Installation | 0.6529 |

**korean + reranker**:

| # | Note | Rerank Score |
|---|------|-------------|
| 1 | 오픈 소스 취약성 검증 프로그램- snippet 분석 제공 | 8.6247 |
| 2 | 오픈 소스 취약성 검증 프로그램- snippet 분석 제공 | 8.6247 |
| 3 | 오픈 소스 취약성 검증 프로그램- snippet 분석 제공 | 8.6247 |
| 4 | 오픈 소스 취약성 검증 프로그램- snippet 분석 제공 | 8.6247 |
| 5 | 2024-12-28_MAIOSS 오픈소스 보안 취약점 검증 솔루션_웹스크립트 | 8.6154 |

### Query: `TikTok 댓글 분석`


**default (all-MiniLM-L6-v2)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 2026-02-21_C_K뷰티 베트남 TikTok 커머스 | 0.6083 |
| 2 | tiktok-developer-계정 | 0.5958 |
| 3 | 2026-02-21_C_TikTok 댓글 AI 분석 | 0.5947 |
| 4 | tiktok-developer-계정-ip | 0.5946 |
| 5 | 커맨드-정의 | 0.5884 |

**korean (ko-sroberta-multitask)** (vector only):

| # | Note | Score |
|---|------|-------|
| 1 | 댓글-조회-api | 0.7416 |
| 2 | _DASHBOARD | 0.7369 |
| 3 | 2026-02-20_D_TikTok 댓글 AI 분석 | 0.7328 |
| 4 | 2026-02-21_C_TikTok 댓글 AI 분석 | 0.7309 |
| 5 | 다계정-관리 | 0.6168 |

**korean + reranker**:

| # | Note | Rerank Score |
|---|------|-------------|
| 1 | A008-TikTok-Content-Posting-API-Research | 7.9648 |
| 2 | 다계정-관리 | 7.9530 |
| 3 | 2026-02-20_C_K뷰티 베트남 TikTok 커머스 | 7.6867 |
| 4 | 2026-02-21_C_TikTok 댓글 AI 분석 | 7.6128 |
| 5 | 고객리뷰-감성분석 | 7.5084 |


## Notes

- Reranker: cross-encoder/ms-marco-MiniLM-L-6-v2

- Korean model: jhgan/ko-sroberta-multitask (768dim)

- Default model: all-MiniLM-L6-v2 (384dim)

- ⚠️ Korean model uses ~1.5GB RAM
