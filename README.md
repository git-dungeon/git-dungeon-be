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

| 변수         | 설명                                           | 기본값        |
|--------------|------------------------------------------------|---------------|
| `PORT`       | HTTP 서버 포트                                 | `3000`        |
| `LOG_LEVEL`  | Pino 로그 레벨 (`fatal` ~ `trace`)         | `info`        |
| `LOG_PRETTY` | 개발용 컬러/단일라인 로그 출력 여부            | `true` (dev)  |

Typia 검증으로 환경 변수가 부족하거나 형태가 잘못되면 애플리케이션이 부팅 시점에 즉시 실패합니다.

## 로깅 & 요청 컨텍스트

- `nestjs-pino` + `pino-http`를 사용해 모든 HTTP 요청을 JSON 로그로 남깁니다.
- `x-request-id` 헤더를 자동 발급/전파하며 에러 및 응답 메타데이터에 포함합니다.

## API 계약

- 컨트롤러는 `@TypedRoute`, `@TypedBody` 등 Nestia 데코레이터를 사용합니다.
- `pnpm contract:generate` 실행 시 `generated/` 디렉터리에 SDK와 Swagger 파일이 생성됩니다.
- 생성물은 아직 커밋하지 않으며, 필요 시 배포 파이프라인에서 활용합니다.

## 테스트

- Vitest + Supertest 조합으로 글로벌 필터/미들웨어/인터셉터 동작을 검증합니다.
- `pnpm test:cov`로 커버리지 리포트를 생성할 수 있습니다.

## 추가 문서화

추후 PRD/설계 문서는 `docs/` 디렉터리에 정리하며, 마일스톤/태스크 완료 시 동기화합니다.
