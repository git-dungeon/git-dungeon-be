# Git Dungeon Backend

NestJS 기반 백엔드 서비스의 인프라/계약 구성을 위한 초기 프로젝트입니다. Typia + Nestia 조합으로 런타임 검증과 SDK/Swagger 생성을 자동화하며, Pino 로거와 RequestId 미들웨어를 통해 일관된 JSON 로그를 제공합니다.

## 요구 사항

- Node.js 22+
- pnpm 10+

## 주요 스크립트

```bash
pnpm start:dev          # 개발 서버 (watch)
pnpm build && pnpm start # 프로덕션 빌드 및 실행
pnpm test               # Vitest 단위 테스트
pnpm contract:generate  # Nestia SDK + Swagger 생성
pnpm contract:swagger   # Swagger 문서만 생성
```

## 환경 변수

`.env.example`을 참고하여 필요한 값을 설정합니다.

| 변수                       | 설명                                        | 기본값                                                                               |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                     | HTTP 서버 포트                              | `3000`                                                                               |
| `LOG_LEVEL`                | Pino 로그 레벨 (`fatal` ~ `trace`)          | `info`                                                                               |
| `LOG_PRETTY`               | 개발용 컬러/단일라인 로그 출력 여부         | `true` (dev)                                                                         |
| `CORS_ALLOWED_ORIGINS`     | 허용할 오리진 목록(콤마 구분)                | `http://localhost:4173,http://localhost:5173,https://staging.gitdungeon.com,https://app.gitdungeon.com` |
| `CORS_ALLOW_CREDENTIALS`   | 쿠키 등 credentials 포함 요청 허용 여부     | `true`                                                                               |
| `PUBLIC_BASE_URL`          | 외부에 공개된 백엔드 기본 Origin (OAuth 브리지/미들웨어 기준) | `http://localhost:3000` (dev), 배포 환경 필수 설정                                   |
| `DATABASE_URL`             | Prisma 기본 데이터베이스 접속 문자열        | `postgresql://gitdungeon:gitdungeon@localhost:5432/git_dungeon?schema=public`        |
| `DATABASE_SHADOW_URL`      | Prisma 마이그레이션용 섀도우 DB 접속 문자열 | `postgresql://gitdungeon:gitdungeon@localhost:5432/git_dungeon_shadow?schema=public` |
| `DATABASE_LOG_QUERIES`     | Prisma 쿼리 로깅 여부                       | `false` (prod), `true` (dev)                                                         |
| `DATABASE_SKIP_CONNECTION` | 앱 부트 시 Prisma 연결 생략 여부 (테스트용) | `false` (dev), `true` (test)                                                         |

Typia 검증으로 환경 변수가 부족하거나 형태가 잘못되면 애플리케이션이 부팅 시점에 즉시 실패합니다.

### CORS 정책

- 기본값은 개발용 `localhost` 도메인과 스테이징/프로덕션 오리진을 모두 허용합니다.
- 추가 오리진이 필요하면 `CORS_ALLOWED_ORIGINS`에 콤마로 구분해 등록합니다.
- 모든 프런트엔드 쿠키 기반 인증을 위해 `CORS_ALLOW_CREDENTIALS=true` 상태를 유지하고, 프록시/로드밸런서에서도 동일하게 허용해야 합니다.

## GitHub OAuth 설정

better-auth 기반 GitHub OAuth 플로우를 사용하려면 다음 단계를 수행합니다.

1. **GitHub OAuth App 생성**
   - Organization → *Settings* → *Developer settings* → *OAuth Apps* 에서 새 앱을 생성합니다.
   - Homepage URL: `https://app.gitdungeon.com`
   - Authorization callback URL (better-auth 서버 콜백 기준):
     - 개발: `http://localhost:3000/api/auth/callback/github`
     - 스테이징: `https://staging-api.gitdungeon.com/api/auth/callback/github`
     - 프로덕션: `https://api.gitdungeon.com/api/auth/callback/github`
   - *Client ID*와 *Client Secret*을 발급받아 비밀 관리 스토리지(예: AWS Secrets Manager)에 저장합니다.

2. **환경 변수 주입**
   - 서버 실행 환경에 아래 값을 설정합니다.

     | 변수 | 설명 |
     | ---- | ---- |
     | `AUTH_GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
     | `AUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
     | `AUTH_GITHUB_REDIRECT_URI` | better-auth가 GitHub 인증 완료 후 호출할 callback URL (`/api/auth/callback/github`) |
     | `AUTH_GITHUB_SCOPE` | 추가 OAuth scope 목록 (기본값 `read:user,user:email`) |

   - 값이 누락되면 부팅 시점에 Typia 검증이 실패하므로, 배포 전에 Secrets/ConfigMap 등을 통해 주입 여부를 확인합니다.

3. **보안 체크**
   - `/auth/github` 엔드포인트는 내부 경로(`/...`)만 redirect 대상으로 허용하므로, 프런트엔드는 `sanitizeRedirectPath`를 사용해 동일 규칙을 준수합니다.
   - better-auth 콜백(`/api/auth/callback/github`) 이후에는 백엔드 브릿지(`/auth/github/redirect`)가 최종 SPA 경로로 리다이렉트하므로, 허용된 origin(`CORS_ALLOWED_ORIGINS`) 구성이 최신인지 확인합니다.
   - GitHub 비밀키는 저장소에 커밋하지 말고, `.env` 대신 운영 전용 Secret으로 관리합니다.

4. **연동 검증**
   - 로컬에서 `pnpm start:dev` 실행 후 `http://localhost:3000/auth/github?redirect=/dashboard` 호출 시 GitHub authorize 화면으로 리다이렉트되는지 확인합니다.
   - `pnpm test` 수행 시 `/auth/github` Supertest 케이스가 redirect/보안 검사 시나리오를 검증합니다.

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
pnpm prisma:generate   # Prisma Client 재생성
pnpm prisma:migrate:dev  # 개발 환경에서 스키마 싱크 & 마이그레이션 파일 생성
pnpm db:migrate        # 프로덕션/CI 배포용 마이그레이션 실행
pnpm db:seed           # prisma/seed.ts 실행
```

- 스키마 수정 후에는 `prisma/migrations/` 폴더에 SQL이 생성되며, PR에 포함해야 합니다.
- better-auth 연동을 위해 `User`, `Account`, `Session`, `Verification`, `RateLimit` 테이블 구조가 포함돼 있으므로, 새로 환경을 구성할 때는 `pnpm prisma:migrate:dev`로 최신 스키마를 적용한 뒤 `pnpm prisma:generate`를 실행합니다.
- `pnpm db:reset`은 전체 데이터베이스를 리셋하고 최신 마이그레이션/시드를 적용합니다.
- CI나 Vitest 실행 시 DB 접속이 필요 없을 경우 `DATABASE_SKIP_CONNECTION=true`를 지정하면 부트스트랩 시 Prisma 연결을 건너뜁니다.

## 로깅 & 요청 컨텍스트

- `nestjs-pino` + `pino-http`를 사용해 모든 HTTP 요청을 JSON 로그로 남깁니다.
- `x-request-id` 헤더를 자동 발급/전파하며 에러 및 응답 메타데이터에 포함합니다.

## API 계약

- 컨트롤러는 `@TypedRoute`, `@TypedBody` 등 Nestia 데코레이터를 사용합니다.
- `pnpm contract:generate` 실행 시 `generated/` 디렉터리에 SDK와 Swagger 파일이 생성됩니다.

## 테스트

- Vitest + Supertest 조합으로 글로벌 필터/미들웨어/인터셉터 동작을 검증합니다.
- `pnpm test:cov`로 커버리지 리포트를 생성할 수 있습니다.
