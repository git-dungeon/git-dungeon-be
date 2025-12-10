import { describe, expect, it } from 'vitest';
import { DungeonLogAction, DungeonLogCategory } from '@prisma/client';
import {
  LOGS_DEFAULT_LIMIT,
  LOGS_MAX_LIMIT,
  LOGS_MIN_LIMIT,
} from './logs.constants';
import { validateLogsQuery } from './logs-query.validator';

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
    const action = validateLogsQuery({ type: DungeonLogAction.BATTLE }).type;
    const category = validateLogsQuery({
      type: DungeonLogCategory.EXPLORATION,
    }).type;

    expect(action).toBe(DungeonLogAction.BATTLE);
    expect(category).toBe(DungeonLogCategory.EXPLORATION);
  });

  it('type이 잘못되면 예외를 던진다', () => {
    expect(() => validateLogsQuery({ type: 'UNKNOWN' })).toThrow();
  });
});
