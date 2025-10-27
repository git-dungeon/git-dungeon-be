import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  successResponse,
  successResponseWithGeneratedAt,
  errorResponse,
} from '../api-response';

describe('api-response 헬퍼', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('successResponse는 주어진 meta와 데이터를 래핑한다', () => {
    const meta = { requestId: 'req-1' };
    const result = successResponse({ value: 1 }, meta);

    expect(result).toEqual({
      success: true,
      data: { value: 1 },
      meta,
    });
  });

  it('successResponseWithGeneratedAt는 requestId 없으면 예외를 던진다', () => {
    expect(() => successResponseWithGeneratedAt({ ok: true })).toThrow(
      'successResponseWithGeneratedAt requires `meta.requestId`. Please pass the current request id explicitly.',
    );
  });

  it('successResponseWithGeneratedAt는 ISO 타임스탬프를 주입한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-27T07:00:00.000Z'));

    const result = successResponseWithGeneratedAt(
      { ok: true },
      { requestId: 'req-1' },
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(result.meta.generatedAt).toBe('2025-10-27T07:00:00.000Z');
    expect(result.meta.requestId).toBe('req-1');
  });

  it('successResponseWithGeneratedAt는 추가 meta를 병합한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-27T07:00:00.000Z'));

    const result = successResponseWithGeneratedAt(
      { ok: true },
      { requestId: 'req-42' },
    );

    expect(result.meta.requestId).toBe('req-42');
    expect(result.meta.generatedAt).toBe('2025-10-27T07:00:00.000Z');
  });

  it('errorResponse는 오류 정보를 meta와 함께 래핑한다', () => {
    const meta = { requestId: 'req-3' };
    const error = {
      code: 'TEST_ERROR',
      message: 'Something went wrong',
    };

    const result = errorResponse(error, meta);

    expect(result).toEqual({
      success: false,
      error,
      meta,
    });
  });
});
