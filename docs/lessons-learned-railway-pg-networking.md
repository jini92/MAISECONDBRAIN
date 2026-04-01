# Lessons Learned: Railway PostgreSQL Private Networking

**Date**: 2026-04-01
**Project**: MAISECONDBRAIN (Mnemo) → Railway PostgreSQL 연결
**Severity**: Critical (서비스 배포 차단)
**Resolution Time**: ~2시간

---

## 문제 요약

Mnemo API 서비스에서 같은 Railway 프로젝트 내 PostgreSQL 서비스에 `postgres.railway.internal:5432`로 연결 시 "Connection refused" 에러 발생.

## 근본 원인

**Railway CLI (`railway add -d postgres`)로 추가한 PostgreSQL은 프로젝트 내부 네트워크에 올바르게 연결되지 않음.**

### 원인 상세

| 추가 방법 | Internal Networking | 결과 |
|----------|-------------------|------|
| Railway 대시보드 ("+ Add → Database → PostgreSQL") | ✅ 자동 설정 | 정상 연결 |
| Railway CLI (`railway add -d postgres`) | ❌ 미설정 | Connection refused |

Railway 대시보드로 서비스를 추가하면 프로젝트의 private network에 자동으로 등록되지만, CLI로 추가하면 네트워크 설정이 누락될 수 있음.

### 추가 발견: HTTP 도메인 vs TCP Proxy

`railway domain` 명령을 PostgreSQL 서비스에서 실행하면 HTTP 도메인이 생성되어 TCP Proxy와 충돌함:

```
# 잘못된 사용
railway service Postgres
railway domain  # HTTP 도메인 생성 → TCP 포트에 HTTP 응답 → 연결 실패

# 올바른 사용
# PostgreSQL은 HTTP 도메인이 필요 없음 → TCP Proxy만 사용
```

PG 서비스에 HTTP 도메인을 생성하면, TCP 프록시 포트(`interchange.proxy.rlwy.net:PORT`)가 HTTP 프로토콜로 응답하여 PostgreSQL 연결이 불가능해짐.

## 해결 과정

1. 기존 CLI로 추가한 PostgreSQL 삭제 (Railway 대시보드 → Settings → Delete Service)
2. Railway 대시보드에서 "+ Add" → "Database" → "PostgreSQL"로 새로 추가
3. 새 `DATABASE_URL` 을 Mnemo-API 서비스에 설정
4. Mnemo API 재배포
5. `/db/sync`로 in-memory 그래프 → PostgreSQL 마이그레이션

## 예방 규칙

### DO (올바른 방법)

```
# 1. 데이터베이스는 반드시 Railway 대시보드에서 추가
Railway Dashboard → Project → "+ Add" → "Database" → "PostgreSQL"

# 2. DATABASE_URL은 Railway 변수 참조로 설정
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# 3. PostgreSQL에 HTTP 도메인 생성하지 않기
# TCP Proxy만 사용 (자동 생성됨)
```

### DON'T (피해야 할 방법)

```
# ❌ CLI로 데이터베이스 추가 (네트워크 미연결 위험)
railway add -d postgres

# ❌ PostgreSQL 서비스에서 railway domain 실행
railway service Postgres
railway domain  # HTTP 도메인이 TCP Proxy를 덮어씌움

# ❌ 크로스 프로젝트 internal hostname 사용
# postgres.railway.internal은 같은 프로젝트 내에서만 유효
```

## 검증 방법

```bash
# v2/health에서 database.available 확인
curl https://mnemo-api-production-5e7a.up.railway.app/v2/health

# 기대 결과:
# {
#   "database": {
#     "available": true,
#     "node_count": 3961,
#     "has_pgvector": true
#   }
# }
```

## 영향 범위

- MAISECONDBRAIN Mnemo API → PostgreSQL 연결
- 향후 Railway에서 Database를 추가하는 모든 프로젝트

## 적용 프로젝트

| 프로젝트 | DB 추가 방법 | 상태 |
|---------|-----------|------|
| MAIQUANT | 대시보드 | ✅ 정상 |
| MAITB | 대시보드 | ✅ 정상 |
| MAISECONDBRAIN | CLI → 대시보드 재추가 | ✅ 수정됨 |

---

*하네스 검증팀 — 2026-04-01*
