import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RANKING_ERROR_CODES } from './ranking.errors';
import { decodeRankingCursor, encodeRankingCursor } from './ranking-cursor.util';

describe('ranking-cursor.util', () => {
  it('커서를 인코딩/디코딩할 수 있어야 한다', () => {
    const payload = { offset: 10 };
    const cursor = encodeRankingCursor(payload);
    const decoded = decodeRankingCursor(cursor);

    expect(decoded).toEqual(payload);
  });

  it('빈 커서는 예외를 던진다', () => {
    try {
      decodeRankingCursor('');
      throw new Error('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: { code: RANKING_ERROR_CODES.INVALID_QUERY },
      });
    }
  });

  it('잘못된 포맷의 커서는 예외를 던진다', () => {
    const invalid = Buffer.from('not-a-number', 'utf8').toString('base64url');
    expect(() => decodeRankingCursor(invalid)).toThrow(BadRequestException);
  });

  it('음수 offset 커서는 예외를 던진다', () => {
    const invalid = Buffer.from('-1', 'utf8').toString('base64url');
    expect(() => decodeRankingCursor(invalid)).toThrow(BadRequestException);
  });
});
