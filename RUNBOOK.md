# Runbook — Git Dungeon Backend

운영/설정/모니터링/복구 가이드입니다.  
환경 변수 정의는 `src/config/environment.ts`, `.env.example` 기준.

---

## 환경 변수

`.env.example`을 참고하여 필요한 값을 설정합니다.

| 변수                                        | 설명                                                           | 기본값                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `PORT`                                      | HTTP 서버 포트                                                 | `3000`                                                                                                  |
| `LOG_LEVEL`                                 | Pino 로그 레벨 (`fatal` ~ `trace`)                             | `info`                                                                                                  |
| `LOG_PRETTY`                                | 개발용 컬러/단일라인 로그 출력 여부                            | `true` (dev)                                                                                            |
| `CORS_ALLOWED_ORIGINS`                      | 허용할 오리진 목록(콤마 구분)                                  | `http://localhost:4173,http://localhost:5173,https://staging.gitdungeon.com,https://app.gitdungeon.com` |
| `CORS_ALLOW_CREDENTIALS`                    | 쿠키 등 credentials 포함 요청 허용 여부                        | `true`                                                                                                  |
| `PUBLIC_BASE_URL`                           | 외부에 공개된 백엔드 기본 Origin (OAuth 브리지/미들웨어 기준)  | `http://localhost:3000` (dev), 배포 환경 필수 설정                                                      |
| `DATABASE_URL`                              | Prisma 기본 데이터베이스 접속 문자열                           | `postgresql://gitdungeon:gitdungeon@localhost:5432/git_dungeon?schema=public`                           |
| `DATABASE_SHADOW_URL`                       | Prisma 마이그레이션용 섀도우 DB 접속 문자열                    | `postgresql://gitdungeon:gitdungeon@localhost:5432/git_dungeon_shadow?schema=public`                    |
| `DATABASE_LOG_QUERIES`                      | Prisma 쿼리 로깅 여부                                          | `false` (prod), `true` (dev)                                                                            |
| `DATABASE_SKIP_CONNECTION`                  | 앱 부트 시 Prisma 연결 생략 여부 (테스트용)                    | `false` (dev), `true` (test)                                                                            |
| `POSTGRES_PORT`                             | 로컬 docker-compose Postgres 노출 포트                         | `5432`                                                                                                  |
| `POSTGRES_USER`                             | 로컬 Postgres 유저명                                           | `gitdungeon`                                                                                            |
| `POSTGRES_PASSWORD`                         | 로컬 Postgres 비밀번호                                         | `gitdungeon`                                                                                            |
| `POSTGRES_DB`                               | 로컬 Postgres DB명                                             | `git_dungeon`                                                                                           |
| `NODE_ENV`                                  | 환경 구분 (dev/production/staging)                             | `development` (dev)                                                                                     |
| `AUTH_GITHUB_CLIENT_ID`                     | GitHub OAuth Client ID                                         | `replace-me`                                                                                            |
| `AUTH_GITHUB_CLIENT_SECRET`                 | GitHub OAuth Client Secret                                     | `replace-me`                                                                                            |
| `AUTH_GITHUB_REDIRECT_URI`                  | GitHub OAuth Redirect URI (백엔드 콜백)                        | `http://localhost:3000/api/auth/callback/github`                                                        |
| `AUTH_GITHUB_SCOPE`                         | GitHub OAuth 스코프                                            | `read:user,user:email`                                                                                  |
| `GITHUB_SYNC_PAT`                           | GitHub GraphQL 백오프/대체용 PAT(옵션)                         | 빈 값(default) → OAuth 토큰만 사용                                                                      |
| `GITHUB_SYNC_PATS`                          | 콤마 구분 PAT 풀(라운드 로빈/백오프 전환용)                    | 비워두면 `GITHUB_SYNC_PAT`만 사용                                                                       |
| `GITHUB_SYNC_ENDPOINT`                      | GitHub GraphQL 엔드포인트                                      | `https://api.github.com/graphql`                                                                        |
| `GITHUB_SYNC_USER_AGENT`                    | GitHub 요청 User-Agent                                         | `git-dungeon-backend`                                                                                   |
| `GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING` | 토큰 스위칭/백오프 임계치                                      | `100`                                                                                                   |
| `GITHUB_SYNC_CRON`                          | 동기화 크론 표현식                                             | `0 0 0 * * *` (매일 00:00:00)                                                                           |
| `GITHUB_SYNC_BATCH_SIZE`                    | 한 번에 처리할 사용자 수                                       | `50`                                                                                                    |
| `GITHUB_SYNC_MANUAL_COOLDOWN_MS`            | 수동 동기화 최소 간격(ms). 기본 6시간(21600000)                | `21600000`                                                                                              |
| `REDIS_URL`                                 | Redis 연결 문자열(BullMQ 재시도 큐)                            | `redis://localhost:6379`                                                                                |
| `GITHUB_TOKEN_LOCK_TTL_MS`                  | 토큰별 Redis 분산 락 TTL(ms)                                   | `30000`                                                                                                 |
| `GITHUB_TOKEN_RATE_LIMIT_CACHE_MS`          | 레이트 리밋 캐시 기본 TTL(ms)                                  | `300000`                                                                                                |
| `GITHUB_TOKEN_COOLDOWN_MS`                  | 토큰 연속 오류/만료 시 쿨다운 TTL(ms)                          | `900000`                                                                                                |
| `REDIS_SKIP_CONNECTION`                     | 테스트 등에서 Redis 연결을 생략할지 여부                       | `false` (test 기본값 true)                                                                              |
| `TEST_FORCE_GITHUB_RATE_LIMIT`              | 테스트용 강제 레이트 리밋 트리거 (prod 금지)                   | `false`                                                                                                 |
| `DUNGEON_INITIAL_AP`                        | 신규 사용자/최초 동기화 시 시드할 AP 값                        | `10`                                                                                                    |
| `DUNGEON_BATCH_CRON`                        | 던전 배치 크론 표현식                                          | `0 */5 * * * *` (5분마다, 초 필드 포함)                                                                 |
| `DUNGEON_BATCH_MAX_USERS_PER_TICK`          | 틱당 처리할 최대 사용자 수                                     | `200`                                                                                                   |
| `DUNGEON_BATCH_MAX_ACTIONS_PER_USER`        | 사용자당 연속 실행 최대 행동 수(AP 소모 횟수)                  | `5`                                                                                                     |
| `DUNGEON_BATCH_MIN_AP`                      | 배치 실행 최소 AP (미만이면 스킵)                              | `1`                                                                                                     |
| `DUNGEON_BATCH_INACTIVE_DAYS`               | 최근 활동 없는 사용자 제외 기간(일, 0이하 시 비활성 필터 해제) | `30`                                                                                                    |
| `DUNGEON_BATCH_LOCK_TTL_MS`                 | per-user Redis 락 TTL(ms)                                      | `60000`                                                                                                 |
| `DUNGEON_BATCH_LOCK_BACKOFF_MS`             | 락 재시도 백오프(ms)                                           | `200`                                                                                                   |
| `DUNGEON_BATCH_LOCK_MAX_RETRY`              | 락 재시도 횟수                                                 | `3`                                                                                                     |
| (동작 메모)                                 | 라운드 로빈 사용자 순회                                        | `userId asc` 커서 기반, 최대치 미달 시 시작점으로 래핑                                                  |
| `QUEUE_RETRY_MAX`                           | BullMQ 재시도 최대 횟수                                        | `3`                                                                                                     |
| `QUEUE_RETRY_BACKOFF_BASE_MS`               | BullMQ 지수 백오프 시작값(ms)                                  | `1500`                                                                                                  |
| `QUEUE_RETRY_TTL_MS`                        | 핸들러 실행 타임아웃(ms, 초과 시 AbortSignal로 중단)           | `7200000` (2시간)                                                                                       |
| `QUEUE_RETRY_CONCURRENCY`                   | 재시도 워커 동시성                                             | `5`                                                                                                     |
| `QUEUE_DLQ_TTL_DAYS`                        | DLQ 보관 일수                                                  | `7`                                                                                                     |
| `ALERT_WEBHOOK_URL`                         | DLQ/연속 실패 알림용 Webhook URL (Discord 등)                  | 빈 값                                                                                                   |
| `ALERT_FAILURE_THRESHOLD`                   | 동일 jobId 연속 실패 알림 임계치                               | `3`                                                                                                     |
 
크론 표현식(`GITHUB_SYNC_CRON`, `DUNGEON_BATCH_CRON`)은 `초 분 시 일 월 요일` 6필드 형식을 사용하며, 서버 로컬 시간 기준으로 평가됩니다.

---

## GitHub PAT 토큰

- GitHub PAT는 GitHub GraphQL 호출 시 OAuth 액세스 토큰이 레이트 리밋에 걸릴 때 대체/백업으로 사용하는 Personal Access Token입니다.
- 발급 위치: GitHub 웹 → `Settings → Developer settings → Personal access tokens`에서 생성하며, 가능하면 읽기 전용 권한만 부여하는 것을 권장합니다.
- `.env`의 `GITHUB_SYNC_PAT`에 단일 PAT를 설정하면 OAuth 토큰 뒤에 이어서 사용됩니다.
- 여러 PAT를 쉼표로 구분해 `GITHUB_SYNC_PATS`에 설정하면, 레이트 리밋/쿨다운 발생 시 백엔드가 자동으로 토큰을 회전하면서 사용합니다.
- 공개 활동만 필요하면 최소 읽기 권한으로 충분하지만, 프라이빗 저장소/조직 기여까지 포함하려면 해당 리소스에 대한 읽기 권한이 있는 PAT를 사용해야 합니다.
- PAT는 비밀번호와 동일한 민감 정보이므로 `.env`에만 보관하고 저장소에 커밋하지 않습니다.

## 로컬 실행

```bash
docker compose up -d postgres redis
pnpm dev
```

---

## 로깅(Pino)

- 로깅 스택: `nestjs-pino` + `pino-http` 기반 JSON 로그를 사용합니다.
- 요청 단위 추적:
  - `RequestContextMiddleware`가 모든 HTTP 요청에 `x-request-id`를 부여하고 응답 헤더에도 그대로 반환합니다.
  - Pino 로그에는 동일한 `requestId` 필드가 포함되므로, 애플리케이션/에러 로그를 Kibana 등에서 트레이싱할 때 `requestId`로 검색할 수 있습니다.
- 포맷/레벨:
  - `LOG_LEVEL`로 로그 레벨(`fatal`~`trace`)을 제어합니다.
  - `LOG_PRETTY=true`인 경우 개발 환경에서 `pino-pretty`를 통해 컬러 + 단일 라인 포맷으로 출력합니다. 운영 환경에서는 JSON 로그를 그대로 사용해 수집 파이프라인과 연동합니다.
- 예외 처리:
  - `HttpExceptionFilter`가 모든 예외를 가로채어 표준화된 에러 바디를 반환하고, Pino를 통해 `err`, `requestId`, `path` 메타 정보를 포함한 에러 로그를 남깁니다.
- 종료 처리:
  - `SIGINT`/`SIGTERM` 수신 시 애플리케이션 종료 전에 Pino logger를 강제로 `flush`해 종료 직전 로그(배치/크론/에러 로그 등)가 유실되지 않도록 합니다.

---

## 던전/AP 도메인 개요

- AP는 GitHub 기여도와 연동된 행동 포인트입니다.
  - 최초 동기화/신규 사용자 생성 시 `DUNGEON_INITIAL_AP`만큼 시드됩니다.
  - GitHub 동기화 시, 이전 동기화 이후 증가한 컨트리뷰션 수만큼 AP가 추가 적립됩니다.
- AP 소비:
  - 던전 배치 크론(`DUNGEON_BATCH_CRON`)이 일정 간격으로 각 사용자의 던전 상태(`dungeonState`)를 조회합니다.
  - `DUNGEON_BATCH_MIN_AP` 이상 AP가 남아 있는 사용자만 대상이며, 1회 행동당 AP 1씩 소모합니다.
  - 사용자당 최대 `DUNGEON_BATCH_MAX_ACTIONS_PER_USER`번까지 자동 탐험을 수행하며, 결과는 `dungeonLog`에 기록됩니다.
- 상태 저장:
  - `dungeonState`에는 레벨/HP/스탯/AP/층수/진행도 등이 저장되며, 각 이벤트 실행 시 버전이 증가합니다.
  - 이벤트 결과(`battle`, `trap`, `treasure` 등)는 로그(`dungeonLog`)로 남아, UI나 리플레이/분석에 사용할 수 있습니다.

### RNG / 시드 전략

- 던전 이벤트/드랍/레벨업 스탯 증가는 시드 기반 RNG(`seedrandom`)로 결정합니다.
- 던전 이벤트 실행 시 시드는 `userId`와 행동 카운터(`actionCounter`)를 조합해 생성합니다(예: `userId:turnNumber`).
- 같은 사용자/같은 턴 번호에 대해서는 항상 동일한 RNG 시퀀스를 사용하므로, 로그를 기준으로 결과를 재현하거나 디버깅/리플레이에 활용할 수 있습니다.
- RNG 사용 위치 예시:
  - 이벤트 타입 선택: `WeightedDungeonEventSelector` (`src/dungeon/events/event-selector.ts`)
  - 드랍 테이블 롤: `DropTableRegistry.rollTable` (`src/dungeon/drops/drop-table.ts`)
  - 레벨업 시 랜덤 스탯 선택: `DungeonEventService.applyExpAndLevelUp` (`src/dungeon/events/dungeon-event.service.ts`)
- 이 RNG는 게임 로직 재현성을 위한 것이며, 암호/보안 목적으로는 사용하지 않습니다.

---

## 카탈로그 운영

- `config/catalog` 내 items/buffs/monsters/drops + i18n
- `catalog.hashes.json` 자동 관리
- 변경 → `pnpm catalog:bump` → `pnpm validate:catalog`
- `/api/catalog?locale=ko` 제공

---

## 배치/큐 운영

- 역할: 적립된 AP를 사용해 일정 간격으로 던전 이벤트를 자동 실행합니다.
- CRON: `DUNGEON_BATCH_CRON` (기본: `0 */5 * * * *`, 5분마다, 서버 로컬 시간 기준).
- 대상 선정: `DUNGEON_BATCH_MIN_AP` 이상 AP를 가진 사용자 중 최근 `DUNGEON_BATCH_INACTIVE_DAYS` 이내 업데이트된 사용자에서 최대 `DUNGEON_BATCH_MAX_USERS_PER_TICK`명까지 선택합니다.
- 1인당 액션 수: 사용자당 최대 `DUNGEON_BATCH_MAX_ACTIONS_PER_USER`회까지, 액션당 AP 1씩 소모하며 던전 이벤트를 실행합니다.
- 작업 처리:
  - `DungeonBatchService`가 `DUNGEON_BATCH_QUEUE`(실제 큐 이름: `dungeon-batch`)에 사용자별 작업을 등록하고, BullMQ 워커가 순차적으로 이벤트를 실행합니다.
  - 동일 사용자에 대한 동시 실행을 막기 위해 Redis 락(`DUNGEON_BATCH_LOCK_*`)을 사용합니다.
- DLQ: `<queue>-dlq`, TTL `QUEUE_DLQ_TTL_DAYS`
- 복구 절차:
  1. 로그에서 `queue="<name>" AND outcome="dlq"` 패턴으로 DLQ 적재 여부를 확인합니다.
  2. 운영 코드 또는 REPL에서 해당 큐 인스턴스의 `listDlq()`를 호출해 페이로드/에러를 확인합니다.
  3. 원인(코드/데이터/외부 시스템)을 수정합니다.
  4. 문제 해결 후 `requeueDlq()`로 DLQ에 쌓인 작업을 다시 메인 큐로 보내 재처리합니다.

---

## GitHub 동기화

- 동기화 대상: GitHub 컨트리뷰션(커밋/PR/리뷰/이슈)을 집계하고, 이전 동기화 이후 증가분만 계산합니다.
- AP 적재: 증가한 컨트리뷰션 수만큼 사용자의 던전 AP를 적립합니다.
- 스케줄러: `GITHUB_SYNC_CRON` (기본: `0 0 0 * * *`, 서버 로컬 시간 기준 매일 00:00)으로 전체 사용자를 배치 처리합니다.
- 수동 호출: `POST /api/github/sync` (쿨다운: `GITHUB_SYNC_MANUAL_COOLDOWN_MS`, 기본 6시간)으로 강제 동기화를 수행합니다.
- 토큰 전략: GitHub OAuth 액세스 토큰을 우선 사용하고, 레이트 리밋/쿨다운 시 `GITHUB_SYNC_PAT`/`GITHUB_SYNC_PATS`에 설정된 PAT 풀로 자동 회전합니다.
- 레이트 리밋: GraphQL 응답의 남은 요청 수가 임계치 이하이거나 모든 토큰이 소진되면 로그를 남기고 재시도 큐를 통해 이후에 다시 시도합니다.

---

## 레이트 리밋 & 보안

- HTTP 레이트 리밋:
  - `ThrottlerModule`을 통해 기본적으로 IP당 분당 60회(`ttl=60000`, `limit=60`)로 요청을 제한합니다.
  - 공개 API에 대한 악의적 트래픽이 의심될 경우, Throttler 설정 조정 또는 프록시/WAF와 함께 사용합니다.
- GitHub 레이트 리밋:
  - GraphQL 응답의 `rateLimit.remaining` 값이 `GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING` 이하로 떨어지면 경고 로그를 남기고, 필요 시 PAT 풀로 토큰을 로테이션합니다.
  - 모든 토큰이 레이트 리밋/쿨다운 상태가 되면, 재시도 큐(`github-sync-retry`)에 작업을 넣고 나중에 다시 시도합니다.
- 토큰 보안:
  - GitHub OAuth client secret, PAT 등 민감 정보는 `.env` 파일이나 시크릿 매니저에만 저장하며, Git 저장소에 커밋하지 않습니다.
  - `TEST_FORCE_GITHUB_RATE_LIMIT`는 테스트용 플래그로, 운영 환경에서는 항상 `false`로 유지해야 합니다.
- Redis/큐 보안:
  - 운영 환경에서는 `REDIS_SKIP_CONNECTION=false`를 유지해 큐가 정상적으로 Redis를 사용하도록 해야 합니다.
  - `ALERT_WEBHOOK_URL`을 설정하면 DLQ 적재/연속 실패 시 웹훅(예: Discord)으로 알림을 전송해 빠르게 대응할 수 있습니다.

---

## OAuth / 인증 / CORS

- GitHub OAuth: `AUTH_GITHUB_*`
- callback: `/api/auth/callback/github`
- CORS origin 명시 필수

---

## 던전 이벤트 설정

- 파일: `src/dungeon/events/config/event-config.json`
- 값 누락 → 기본값 폴백

---

## DB 운영

```bash
pnpm db:migrate:dev
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

테스트/CI에서는 `DATABASE_SKIP_CONNECTION=true` 가능.

---

## 실패 사례 Playbook

### DLQ 적재

1. `queue="<name>" AND outcome="dlq"`
2. `listDlq()`
3. 원인 수정
4. `requeueDlq()`

### GitHub 레이트 리밋

- 로그에서 `RATE_LIMITED`
- `resetAt`까지 대기
- PAT 추가 or CRON 완화

### Redis 실패

- Redis 인스턴스 점검
- 운영에서는 `REDIS_SKIP_CONNECTION=false` 유지

### OAuth 오류

- redirect URI 불일치 확인
- CORS 오리진 점검

---

## 배포/모니터링

- 배포 체크: lint → test → build → deploy → `/health`
- 모니터링:
  - 큐 실패율
  - DLQ 증가
  - GitHub rate limit
  - Redis/DB 연결 상태
