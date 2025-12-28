/**
 * Rate Limit 설정
 *
 * 환경 변수로 오버라이드 가능:
 * - THROTTLE_TTL_MS: TTL (밀리초)
 * - THROTTLE_LIMIT: 요청 제한 횟수
 *
 * 테스트에서는 vi.mock으로 이 모듈을 모킹하여 고정값 사용
 */

const DEFAULT_TTL = 60_000;
const DEFAULT_LIMIT = 60;

export const DEFAULT_THROTTLE_TTL_MS =
  parseInt(process.env.THROTTLE_TTL_MS ?? '', 10) || DEFAULT_TTL;

export const DEFAULT_THROTTLE_LIMIT =
  parseInt(process.env.THROTTLE_LIMIT ?? '', 10) || DEFAULT_LIMIT;
