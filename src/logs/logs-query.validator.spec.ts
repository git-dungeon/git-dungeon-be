import { describe, expect, it } from 'vitest';
import {
  LOGS_DEFAULT_LIMIT,
  LOGS_MAX_LIMIT,
  LOGS_MIN_LIMIT,
} from './logs.constants';
import { validateLogsQuery } from './logs-query.validator';
import {
  LOG_ACTION_VALUES,
  LOG_CATEGORY_VALUES,
  LogTypeEnum,
} from './logs.types';
import { encodeLogsCursor } from './logs-cursor.util';

describe('validateLogsQuery', () => {
  it('limit 기본값을 적용한다', () => {
    const result = validateLogsQuery({});
    expect(result.limit).toBe(LOGS_DEFAULT_LIMIT);
  });

  it('limit 최소/최대를 허용한다', () => {
    expect(validateLogsQuery({ limit: LOGS_MIN_LIMIT }).limit).toBe(
      LOGS_MIN_LIMIT,
    );
    expect(validateLogsQuery({ limit: LOGS_MAX_LIMIT }).limit).toBe(
      LOGS_MAX_LIMIT,
    );
  });

  it('limit가 범위를 벗어나면 예외를 던진다', () => {
    expect(() => validateLogsQuery({ limit: 0 })).toThrow();
    expect(() => validateLogsQuery({ limit: 999 })).toThrow();
  });

  it('type이 유효하면 파싱한다', () => {
    const action = validateLogsQuery({ type: LogTypeEnum.BATTLE }).type;
    const category = validateLogsQuery({ type: LogTypeEnum.EXPLORATION }).type;

    expect(action).toBe(LOG_ACTION_VALUES[0]);
    expect(category).toBe(LOG_CATEGORY_VALUES[0]);
  });

  it('type이 잘못되면 예외를 던진다', () => {
    expect(() =>
      validateLogsQuery({ type: 'UNKNOWN' as unknown as LogTypeEnum }),
    ).toThrow();
  });

  it('cursor가 유효하면 파싱한다', () => {
    const cursor = encodeLogsCursor({ sequence: 123n });
    const result = validateLogsQuery({ cursor });
    expect(result.cursorPayload).toEqual({ sequence: 123n });
  });

  it('기존 createdAt|id 포맷 cursor는 예외를 던진다', () => {
    const legacy = Buffer.from(
      '2025-01-01T00:00:00.000Z|00000000-0000-4000-8000-0000000000f1',
      'utf8',
    ).toString('base64url');
    expect(() => validateLogsQuery({ cursor: legacy })).toThrow();
  });

  it('from/to가 유효하면 Date로 파싱한다', () => {
    const from = '2026-01-01T00:00:00.000Z';
    const to = '2026-01-31T23:59:59.999Z';
    const result = validateLogsQuery({ from, to });
    expect(result.from?.toISOString()).toBe(from);
    expect(result.to?.toISOString()).toBe(to);
  });

  it('from/to 형식이 잘못되면 예외를 던진다', () => {
    expect(() => validateLogsQuery({ from: 'invalid-date' })).toThrow();
    expect(() => validateLogsQuery({ to: 'not-a-date' })).toThrow();
  });

  it('from이 to보다 크면 예외를 던진다', () => {
    const from = '2026-02-01T00:00:00.000Z';
    const to = '2026-01-01T00:00:00.000Z';
    expect(() => validateLogsQuery({ from, to })).toThrow();
  });
});
