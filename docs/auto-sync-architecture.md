# Mnemo 자동 동기화 아키텍처

**Date**: 2026-04-01
**Status**: Production

---

## 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ 로컬 PC (Windows 예약 작업, 매일 05:00 KST)                   │
│                                                             │
│  Obsidian Vault (JINI_SYNC)                                │
│       ↓                                                     │
│  daily_enrich.py                                           │
│   ├── Step 1: 파싱 (vault + memory)                         │
│   ├── Step 2: 타입/프로젝트 추론                               │
│   ├── Step 3: 관련 링크 발견                                  │
│   ├── Step 4: 태그 추출 + 백링크                               │
│   ├── Step 5: 그래프 빌드 (NetworkX)                          │
│   ├── Step 6: 온톨로지 검증                                   │
│   ├── Step 7: 외부 지식 수집                                  │
│   ├── Step 8: 대시보드 동기화                                  │
│   ├── Step 9: 기회 탐지                                      │
│   └── Step 10: 서버 동기화 ← HTTP API                        │
│        ↓                                                    │
│  POST /db/import (500개 배치)                                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Railway: MAISECONDBRAIN                                     │
│                                                             │
│  Mnemo API (FastAPI)                                       │
│   ├── /v2/search — 통합 검색 (DB 우선)                       │
│   ├── /v2/health — 메모리 + DB 상태                          │
│   ├── /db/import — 벌크 가져오기                              │
│   ├── /db/nodes — 노드 CRUD                                 │
│   ├── /db/edges — 엣지 CRUD                                 │
│   └── /db/stats — 그래프 통계                                 │
│        ↕                                                    │
│  PostgreSQL + pgvector                                     │
│   ├── knowledge_nodes (3,961)                              │
│   ├── knowledge_edges (49,979)                             │
│   └── knowledge_embeddings (pgvector 1024d)                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP API
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 소비자 프로젝트                                               │
│                                                             │
│  MAIQUANT → /v2/search (투자 분석 컨텍스트)                    │
│  MAIKAKAO → /v2/search (채팅 컨텍스트)                        │
│  MAIBOT   → /v2/search (오케스트레이터 리콜)                   │
└─────────────────────────────────────────────────────────────┘
```

## 실행 주기

| 작업 | 주기 | 실행 위치 | 트리거 |
|------|------|---------|--------|
| daily_enrich.py | 매일 05:00 KST | 로컬 PC | Windows 예약 작업 |
| 서버 동기화 (Step 10) | enrichment 완료 후 자동 | 로컬 → Railway | HTTP API |
| 수동 동기화 | 필요 시 | 로컬 CLI | `python sync_to_server.py` |

## 환경 변수

| 변수 | 값 | 설명 |
|------|---|------|
| MNEMO_VAULT_PATH | C:\Users\jini9\OneDrive\Documents\JINI_SYNC | Obsidian 볼트 |
| MNEMO_MEMORY_PATH | C:\MAIBOT\memory | MAIBOT 메모리 |
| MNEMO_API_URL | https://mnemo-api-production-5e7a.up.railway.app | Railway API |

## 로컬 예약 작업 설정

Windows Task Scheduler:
- 이름: `Mnemo_DailyEnrich`
- 트리거: 매일 05:00
- 실행: `run_daily_enrich.vbs`
- 조건: PC가 켜져 있을 때만 (놓친 실행은 다음 기회에)

## 제약 사항

- Obsidian 볼트가 로컬에만 존재 → enrichment는 반드시 로컬 실행
- PC 꺼져 있으면 enrichment 미실행 → 서버 데이터는 마지막 동기화 시점 유지
- 서버는 read-only API만 제공 → 소비자가 직접 수정 불가 (CRUD는 관리용)

## 향후 개선

- Obsidian 볼트 → GitHub 자동 동기화 시 GitHub Actions로 enrichment 이전 가능
- Railway cron으로 주기적 서버 self-rebuild (GitHub에서 볼트 clone 후 enrichment)
