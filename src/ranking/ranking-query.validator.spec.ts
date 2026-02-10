import { describe, expect, it } from 'vitest';
import {
  RANKING_DEFAULT_LIMIT,
  RANKING_MAX_LIMIT,
  RANKING_MIN_LIMIT,
} from './ranking.constants';
import { validateRankingQuery } from './ranking-query.validator';
import type { RankingQueryDto } from './dto/ranking-query.dto';
import { encodeRankingCursor } from './ranking-cursor.util';

describe('validateRankingQuery', () => {
  it('limit 기본값을 적용한다', () => {
    const result = validateRankingQuery({});
    expect(result.limit).toBe(RANKING_DEFAULT_LIMIT);
  });

  it('limit 최소/최대를 허용한다', () => {
    expect(validateRankingQuery({ limit: RANKING_MIN_LIMIT }).limit).toBe(
      RANKING_MIN_LIMIT,
    );
    expect(validateRankingQuery({ limit: RANKING_MAX_LIMIT }).limit).toBe(
      RANKING_MAX_LIMIT,
    );
  });

  it('limit가 범위를 벗어나면 예외를 던진다', () => {
    expect(() => validateRankingQuery({ limit: 0 })).toThrow();
    expect(() => validateRankingQuery({ limit: 999 })).toThrow();
  });

  it('limit가 정수가 아니면 예외를 던진다', () => {
    expect(() =>
      validateRankingQuery({ limit: '10abc' } as unknown as RankingQueryDto),
    ).toThrow();
    expect(() =>
      validateRankingQuery({ limit: '1.5' } as unknown as RankingQueryDto),
    ).toThrow();
    expect(() =>
      validateRankingQuery({ limit: 1.5 } as unknown as RankingQueryDto),
    ).toThrow();
  });

  it('limit가 숫자 문자열이면 파싱한다', () => {
    expect(
      validateRankingQuery({ limit: '10' } as unknown as RankingQueryDto).limit,
    ).toBe(10);
  });

  it('cursor가 유효하면 파싱한다', () => {
    const cursor = encodeRankingCursor({ offset: 12 });
    const result = validateRankingQuery({ cursor });
    expect(result.cursorPayload).toEqual({ offset: 12 });
  });
});
