# Git Dungeon Backend

NestJS 기반 게임 API 서버입니다.  
Typia + Nestia로 타입 안전한 SDK/컨트랙트를 생성하고, Pino + RequestId로 일관된 JSON 로그를 남깁니다.  
BullMQ + Redis로 배치/큐 작업을 처리하고, Prisma + PostgreSQL을 사용해 데이터베이스를 관리합니다.

> 운영·배포·트러블슈팅 가이드는 [`RUNBOOK.md`](./RUNBOOK.md)를 참고하세요.

---

## Quick Start

### 요구사항

- Node.js **22+**
- pnpm **10+**
- Docker (선택 사항이지만 로컬 Postgres/Redis에 권장)
- Docker Compose

### 설치 및 실행

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm dev
```

API 문서: [로컬 API 문서](http://localhost:3000/api)

### 테스트 / 빌드

```bash
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm start:prod
```

---

## 기술 스택

- NestJS, Typia/Nestia, Pino(RequestId), BullMQ + Redis
- Prisma + PostgreSQL
- GitHub OAuth (better-auth)

---

## 설정 & 환경 변수

환경 변수 전체는 `.env.example` 참고.  
환경 로딩은 `src/config/environment.ts` 참조.

### 로깅(Pino)

- HTTP 요청/응답 및 애플리케이션 로그는 `nestjs-pino` 기반 JSON 로그로 출력됩니다.
- 각 요청에는 `x-request-id` 헤더(없으면 서버에서 생성)가 부여되며, Pino 로그에도 함께 기록되어 트레이싱에 사용됩니다.
- `LOG_LEVEL`로 로그 레벨(`fatal`~`trace`)을 제어하고, `LOG_PRETTY=true`인 경우 개발 환경에서 `pino-pretty`를 사용해 단일 라인/컬러 포맷으로 출력합니다.
- 종료 시 Pino logger를 flush하여 크론/배치·에러 로그가 유실되지 않도록 처리하고 있습니다.

---

## GitHub 동기화 & AP

- GitHub OAuth로 로그인한 사용자의 컨트리뷰션(커밋/PR/리뷰/이슈)을 주기적으로 동기화합니다.
- 동기화된 컨트리뷰션 증가분만큼 던전 AP를 적립하고, 배치 크론이 AP를 사용해 자동으로 탐험을 진행합니다.
- GitHub GraphQL 레이트 리밋 완화를 위해 PAT를 `.env`의 `GITHUB_SYNC_PAT` 또는 `GITHUB_SYNC_PATS`에 설정할 수 있습니다.
- 자세한 토큰/크론/동기화 동작은 `RUNBOOK.md`의 GitHub 동기화 섹션을 참고하세요.

---

## 크론 작업

- GitHub 동기화 크론: `GITHUB_SYNC_CRON` (기본: `0 0 0 * * *`, 서버 로컬 시간 기준 매일 00:00).
- 던전 배치/AP 소비 크론: `DUNGEON_BATCH_CRON` (기본: `0 */5 * * * *`, 5분마다 실행).
- 크론 표현식은 `초 분 시 일 월 요일` 6필드 형식을 사용합니다.

---

## 운영 / 모니터링 개요

- 배치/큐 실패 로그 필터: `queue="dungeon-batch" AND outcome!="success"`
- DLQ 적재 시 웹훅 알림
- GitHub Sync 레이트 리밋 감지

---

## 라이선스

TODO
