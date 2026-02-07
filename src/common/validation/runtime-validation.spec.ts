import { describe, expect, it } from 'vitest';
import { assertIsoDateTimeString, assertOneOf } from './runtime-validation';

describe('runtime-validation', () => {
  it('assertIsoDateTimeString은 느슨한 날짜 문자열을 거부해야 한다', () => {
    expect(() => assertIsoDateTimeString('2024', '$.value')).toThrowError(
      /ISO date-time string/,
    );
    expect(() =>
      assertIsoDateTimeString('2026-02-06T10:20:30.000Z', '$.value'),
    ).not.toThrow();
  });

  it('assertOneOf는 빈 candidates를 허용하지 않아야 한다', () => {
    expect(() => assertOneOf('value', '$.field', [])).toThrowError(
      /non-empty candidates/,
    );
  });
});
