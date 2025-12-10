import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LOGS_ERROR_CODES } from './logs.errors';
import { decodeLogsCursor, encodeLogsCursor } from './logs-cursor.util';

describe('logs-cursor.util', () => {
  it('커서를 인코딩/디코딩할 수 있어야 한다', () => {
    const payload = {
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      id: 'log-123',
    };

    const cursor = encodeLogsCursor(payload);
    const decoded = decodeLogsCursor(cursor);

    expect(decoded).toEqual(payload);
  });

  it('빈 커서는 예외를 던진다', () => {
    try {
      decodeLogsCursor('');
      throw new Error('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: { code: LOGS_ERROR_CODES.INVALID_QUERY },
      });
    }
  });

  it('잘못된 포맷의 커서는 예외를 던진다', () => {
    const invalid = Buffer.from('2025-01-01T00:00:00.000Z', 'utf8').toString(
      'base64url',
    );

    expect(() => decodeLogsCursor(invalid)).toThrow(BadRequestException);
  });

  it('날짜가 깨진 커서도 예외를 던진다', () => {
    const invalidDate = Buffer.from('invalid-date|log-1', 'utf8').toString(
      'base64url',
    );

    expect(() => decodeLogsCursor(invalidDate)).toThrow(BadRequestException);
  });
});
