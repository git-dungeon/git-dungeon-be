# Git Dungeon Backend

NestJS 기반 백엔드 서비스의 인프라/계약 구성을 위한 초기 프로젝트입니다. Typia + Nestia 조합으로 런타임 검증과 SDK/Swagger 생성을 자동화하며, Pino 로거와 RequestId 미들웨어를 통해 일관된 JSON 로그를 제공합니다.

## 요구 사항

- Node.js 22+
- pnpm 10+

## 주요 스크립트

### 개발 & 빌드

```bash
pnpm dev                # 개발 서버 (watch) - 가장 많이 사용
pnpm start:dev          # 개발 서버 (watch)
pnpm start:debug        # 디버그 모드 개발 서버
pnpm build              # 프로덕션 빌드
pnpm start:prod         # 프로덕션 빌드된 앱 실행
pnpm build && pnpm start # 빌드 후 실행
```

### 테스트

```bash
pnpm test               # Vitest 단위 테스트
pnpm test:watch         # Watch 모드 테스트
pnpm test:cov           # 커버리지 테스트
```

### 코드 품질

```bash
pnpm format             # 코드 포매팅 (Prettier)
pnpm lint               # ESLint 검사 및 수정
pnpm prepare            # ts-patch 및 typia 설정
```

### 데이터베이스 & API

```bash
pnpm contract:generate  # Nestia SDK 생성
pnpm sdk:generate       # 타입 안전 SDK 생성
pnpm swagger:generate   # Swagger 문서 생성 (개발 환경)
pnpm swagger:generate:prod # Swagger 문서 생성 (프로덕션 환경)
pnpm swagger:generate:staging # Swagger 문서 생성 (스테이징 환경)
pnpm swagger:open       # Swagger UI 브라우저에서 열기
```

## 환경 변수

`.env.example`을 참고하여 필요한 값을 설정합니다.

| 변수                       | 설명                                                          | 기본값                                                                                                  |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `PORT`                     | HTTP 서버 포트                                                | `3000`                                                                                                  |
| `LOG_LEVEL`                | Pino 로그 레벨 (`fatal` ~ `trace`)                            | `info`                                                                                                  |
| `LOG_PRETTY`               | 개발용 컬러/단일라인 로그 출력 여부                           | `true` (dev)                                                                                            |
| `CORS_ALLOWED_ORIGINS`     | 허용할 오리진 목록(콤마 구분)                                 | `http://localhost:4173,http://localhost:5173,https://staging.gitdungeon.com,https://app.gitdungeon.com` |
| `CORS_ALLOW_CREDENTIALS`   | 쿠키 등 credentials 포함 요청 허용 여부                       | `true`                                                                                                  |
| `PUBLIC_BASE_URL`          | 외부에 공개된 백엔드 기본 Origin (OAuth 브리지/미들웨어 기준) | `http://localhost:3000` (dev), 배포 환경 필수 설정                                                      |
| `DATABASE_URL`             | Prisma 기본 데이터베이스 접속 문자열                          | `postgresql://gitdungeon:gitdungeon@localhost:5432/git_dungeon?schema=public`                           |
| `DATABASE_SHADOW_URL`      | Prisma 마이그레이션용 섀도우 DB 접속 문자열                   | `postgresql://gitdungeon:gitdungeon@localhost:5432/git_dungeon_shadow?schema=public`                    |
| `DATABASE_LOG_QUERIES`     | Prisma 쿼리 로깅 여부                                         | `false` (prod), `true` (dev)                                                                            |
| `DATABASE_SKIP_CONNECTION` | 앱 부트 시 Prisma 연결 생략 여부 (테스트용)                   | `false` (dev), `true` (test)                                                                            |
| `NODE_ENV`                 | 환경 구분 (dev/production/staging)                            | `development` (dev)                                                                                     |
| `GITHUB_SYNC_PAT`          | GitHub GraphQL 백오프/대체용 PAT(옵션)                         | 빈 값(default) → OAuth 토큰만 사용                                                                      |
| `GITHUB_SYNC_PATS`         | 콤마 구분 PAT 풀(라운드 로빈/백오프 전환용)                    | 비워두면 `GITHUB_SYNC_PAT`만 사용                                                                       |
| `GITHUB_SYNC_ENDPOINT`     | GitHub GraphQL 엔드포인트                                      | `https://api.github.com/graphql`                                                                        |
| `GITHUB_SYNC_USER_AGENT`   | GitHub 요청 User-Agent                                         | `git-dungeon-backend`                                                                                   |
| `GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING` | 토큰 스위칭/백오프 임계치                                 | `100`                                                                                                   |
| `GITHUB_SYNC_CRON`         | 동기화 크론 표현식                                             | `0 0 0 * * *` (매일 00:00:00)                                                                           |
| `GITHUB_SYNC_BATCH_SIZE`   | 한 번에 처리할 사용자 수                                       | `50`                                                                                                    |
| `GITHUB_SYNC_MANUAL_COOLDOWN_MS` | 수동 동기화 최소 간격(ms). 기본 6시간(21600000)                 | `21600000`                                                                                              |
| `REDIS_URL`                | Redis 연결 문자열(BullMQ 재시도 큐)                            | `redis://localhost:6379`                                                                                |
| `GITHUB_SYNC_RETRY_MAX`    | BullMQ 재시도 최대 횟수                                        | `3`                                                                                                     |
| `GITHUB_SYNC_RETRY_BACKOFF_BASE_MS` | 재시도 기본 백오프(ms, 지수)                             | `60000`                                                                                                 |
| `GITHUB_SYNC_RETRY_TTL_MS` | 재시도 작업 최대 유효 시간(ms)                                 | `86400000`                                                                                              |
| `GITHUB_SYNC_RETRY_CONCURRENCY` | 재시도 워커 동시성                                       | `5`                                                                                                     |
| `REDIS_SKIP_CONNECTION`    | 테스트 등에서 Redis 연결을 생략할지 여부                      | `false` (test 기본값 true)                                                                              |
| `TEST_FORCE_GITHUB_RATE_LIMIT` | 테스트용 강제 레이트 리밋 트리거 (prod 금지)               | `false`                                                                                                 |
| `DUNGEON_INITIAL_AP`       | 신규 사용자/최초 동기화 시 시드할 AP 값                         | `10`                                                                                                    |

Typia 검증으로 환경 변수가 부족하거나 형태가 잘못되면 애플리케이션이 부팅 시점에 즉시 실패합니다.

## GitHub 동기화 운영 가이드

- 배치: `GITHUB_SYNC_CRON`(기본 매일 00:00:00) 기준으로 `GITHUB_SYNC_BATCH_SIZE`만큼 GitHub OAuth/PAT 토큰을 사용해 기여도를 적재합니다. rate limit 임계(`GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING`)에 도달하면 토큰 스위칭/백오프로 처리합니다.
- 수동 동기화: `POST /api/github/sync` 호출 시 GitHub 계정 연결 필수이며, 최근 성공 시각 기준 6시간(`GITHUB_SYNC_MANUAL_COOLDOWN_MS`) 이내면 `429 GITHUB_SYNC_TOO_FREQUENT`으로 거절됩니다. 레이트 리밋 시 `429 GITHUB_SYNC_RATE_LIMITED`와 남은 한도/리셋 시각 메타를 반환합니다.
- 데이터 흐름: 성공 시 `ap_sync_logs` 기록 및 `dungeon_state.ap` 증가, `connections.github.updatedAt`을 최신 동기화 시각으로 사용합니다(프런트의 비활성화/정보 표시 기준).
- 모니터링/복구: 실패 로그는 `ap_sync_logs`에 `status=FAILED`/`errorCode`로 남습니다. 레이트 리밋 또는 토큰 오류 시 토큰 교체 후 재시도하거나 쿨다운 이후 재호출합니다.
- 관측/알림: GraphQL 호출 결과/오류 로그에 `rateLimit.remaining/resetAt/resource`, 사용 토큰 시도(`tokensTried`), 재시도 횟수(`attempts`), 백오프(`backoffMs`)가 포함되며, 남은 한도가 `GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING` 이하이면 경고 로그로 남깁니다. `ap_sync_logs.meta`에도 동일 메타가 저장돼 장애 시 역추적 가능합니다.

### CORS 정책

- 기본값은 개발용 `localhost` 도메인과 스테이징/프로덕션 오리진을 모두 허용합니다.
- 추가 오리진이 필요하면 `CORS_ALLOWED_ORIGINS`에 콤마로 구분해 등록합니다.
- 모든 프런트엔드 쿠키 기반 인증을 위해 `CORS_ALLOW_CREDENTIALS=true` 상태를 유지하고, 프록시/로드밸런서에서도 동일하게 허용해야 합니다.

## GitHub OAuth 설정

better-auth 기반 GitHub OAuth 플로우를 사용하려면 다음 단계를 수행합니다.

1. **GitHub OAuth App 생성**
   - Organization → _Settings_ → _Developer settings_ → _OAuth Apps_ 에서 새 앱을 생성합니다.
   - Homepage URL: `https://app.gitdungeon.com`
   - Authorization callback URL (better-auth 서버 콜백 기준):
     - 개발: `http://localhost:3000/api/auth/callback/github`
     - 스테이징: `https://staging-api.gitdungeon.com/api/auth/callback/github`
     - 프로덕션: `https://api.gitdungeon.com/api/auth/callback/github`
   - *Client ID*와 *Client Secret*을 발급받아 비밀 관리 스토리지(예: AWS Secrets Manager)에 저장합니다.

2. **환경 변수 주입**
   - 서버 실행 환경에 아래 값을 설정합니다.

     | 변수                        | 설명                                                                                |
     | --------------------------- | ----------------------------------------------------------------------------------- |
     | `AUTH_GITHUB_CLIENT_ID`     | GitHub OAuth Client ID                                                              |
     | `AUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret                                                          |
     | `AUTH_GITHUB_REDIRECT_URI`  | better-auth가 GitHub 인증 완료 후 호출할 callback URL (`/api/auth/callback/github`) |
     | `AUTH_GITHUB_SCOPE`         | 추가 OAuth scope 목록 (기본값 `read:user,user:email`)                               |

   - 값이 누락되면 부팅 시점에 Typia 검증이 실패하므로, 배포 전에 Secrets/ConfigMap 등을 통해 주입 여부를 확인합니다.

3. **보안 체크**
   - `/auth/github` 엔드포인트는 내부 경로(`/...`)만 redirect 대상으로 허용하므로, 프런트엔드는 `sanitizeRedirectPath`를 사용해 동일 규칙을 준수합니다.
   - better-auth 콜백(`/api/auth/callback/github`) 이후에는 백엔드 브릿지(`/auth/github/redirect`)가 최종 SPA 경로로 리다이렉트하므로, 허용된 origin(`CORS_ALLOWED_ORIGINS`) 구성이 최신인지 확인합니다.
   - GitHub 비밀키는 저장소에 커밋하지 말고, `.env` 대신 운영 전용 Secret으로 관리합니다.

4. **연동 검증**
   - 로컬에서 `pnpm start:dev` 실행 후 `http://localhost:3000/auth/github?redirect=/dashboard` 호출 시 GitHub authorize 화면으로 리다이렉트되는지 확인합니다.
   - `pnpm test` 수행 시 `/auth/github` Supertest 케이스가 redirect/보안 검사 시나리오를 검증합니다.

### 인증 Guard 적용 가이드

- 보호가 필요한 API 핸들러에는 `@Authenticated()` 데코레이터를 적용해 `AuthGuard`를 연결합니다. (파일: `src/auth/decorators/authenticated.decorator.ts`)
- Guard는 성공한 세션 정보를 `request.authSession`으로 주입하므로, 핸들러에서는 `@CurrentAuthSession()`을 사용해 세션 뷰를 재사용할 수 있습니다.
- 기본적으로 보호돼야 하는 라우트는 다음과 같습니다.
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
  - `GET /api/auth/whoami`
- 새 API 추가 시 인증이 필요하면 `@Authenticated()`와 `@CurrentAuthSession()`을 함께 사용하고, 공개 API라면 데코레이터 없이 구현합니다.
- 현재 Guard/데코레이터 조합은 HTTP 요청 전용이며, WebSocket/RPC 등 다른 컨텍스트에는 별도 어댑터가 필요합니다.

## 데이터베이스

### Docker Compose로 PostgreSQL 실행

```bash
# 컨테이너 기동
docker compose up -d postgres

# 정상 기동 여부 확인
docker compose ps postgres
```

- 기본 데이터베이스는 `git_dungeon`, 섀도우 데이터베이스는 `git_dungeon_shadow`로 초기화됩니다.
- 포트/계정 정보는 `.env.example`과 동일하며 필요 시 `POSTGRES_*` 환경 변수로 오버라이드할 수 있습니다.

### 마이그레이션 & 시드

```bash
pnpm db:generate       # Prisma Client 재생성 (권장)
pnpm prisma:generate   # Prisma Client 직접 실행 (별칭)
pnpm db:migrate:dev    # 개발 환경에서 스키마 싱크 & 마이그레이션 파일 생성
pnpm db:migrate        # 프로덕션/CI 배포용 마이그레이션 실행
pnpm db:seed           # prisma/seed.ts 실행
pnpm db:reset          # 데이터베이스 전체 리셋 및 마이그레이션/시드 재적용
```

- 스키마 수정 후에는 `prisma/migrations/` 폴더에 SQL이 생성되며, PR에 포함해야 합니다.
- better-auth 연동을 위해 `User`, `Account`, `Session`, `Verification`, `RateLimit` 테이블 구조가 포함돼 있으므로, 새로 환경을 구성할 때는 `pnpm prisma:migrate:dev`로 최신 스키마를 적용한 뒤 `pnpm prisma:generate`를 실행합니다.
- `pnpm db:reset`은 전체 데이터베이스를 리셋하고 최신 마이그레이션/시드를 적용합니다.
- CI나 Vitest 실행 시 DB 접속이 필요 없을 경우 `DATABASE_SKIP_CONNECTION=true`를 지정하면 부트스트랩 시 Prisma 연결을 건너뜁니다.

## 로깅 & 요청 컨텍스트

- `nestjs-pino` + `pino-http`를 사용해 모든 HTTP 요청을 JSON 로그로 남깁니다.
- `x-request-id` 헤더를 자동 발급/전파하며 에러 및 응답 메타데이터에 포함합니다.

## API 계약 (Nestia)

- 컨트롤러는 `@TypedRoute`, `@TypedBody` 등 Nestia 데코레이터를 사용합니다.
- SDK 생성: `pnpm sdk:generate` 실행 시 `generated/sdk/` 디렉터리에 타입 안전 클라이언트 SDK가 생성됩니다.
- Swagger 문서 생성: `pnpm swagger:generate` 실행 시 `generated/swagger.json`가 생성됩니다.
- 런타임 Swagger UI: 앱 실행 후 `http://localhost:3000/api`에서 실시간 API 문서를 확인할 수 있습니다.

### Typia 런타임 검증

- 모든 신규·기존 API는 입력·출력 DTO에 대해 `typia.assert`(또는 `typia.validate`) 기반 런타임 검증을 적용하도록 권장합니다.
- Typia `tags`를 활용하면 길이, 패턴, 범위 등 필드별 제약을 명시할 수 있으며, 계약에 구체적 규칙이 추가될 때 DTO에 함께 도입합니다.

## Swagger 문서 활용

### 개발 환경

- **런타임 UI**: `pnpm dev` 실행 후 `http://localhost:3000/api` 접속
- **실시간 업데이트**: 코드 변경 시 자동으로 최신 API 문서 반영

### 배포 환경

- **프로덕션용 정적 문서**: `pnpm swagger:generate:prod`
- **스테이징용 정적 문서**: `pnpm swagger:generate:staging`

### 외부 툴 연동

- 생성된 `generated/swagger.json` 파일을 API 테스트 툴(Postman, Insomnia 등)에서 가져올 수 있습니다
- Frontend SDK 생성: `pnpm sdk:generate`으로 타입 안전 클라이언트 라이브러리 생성

## 테스트

- Vitest + Supertest 조합으로 글로벌 필터/미들웨어/인터셉터 동작을 검증합니다.
- `pnpm test:cov`로 커버리지 리포트를 생성할 수 있습니다.
