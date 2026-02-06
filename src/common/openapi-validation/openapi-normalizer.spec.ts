import { describe, expect, it } from 'vitest';
import { normalizeOpenApiDocumentForAjv } from './openapi-normalizer';

describe('normalizeOpenApiDocumentForAjv', () => {
  it('nullable: true를 anyOf + null로 정규화해야 한다', () => {
    const input = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          nullable: true,
        },
      },
      required: ['name'],
    };

    const normalized = normalizeOpenApiDocumentForAjv(input) as unknown as {
      properties: { name: unknown };
    };

    expect(normalized.properties.name).toMatchObject({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
  });

  it('nullable: false는 anyOf로 변환하지 않아야 한다', () => {
    const input = {
      type: 'object',
      properties: {
        count: {
          type: 'integer',
          nullable: false,
        },
      },
    };

    const normalized = normalizeOpenApiDocumentForAjv(input) as unknown as {
      properties: { count: unknown };
    };

    expect(normalized.properties.count).toMatchObject({ type: 'integer' });
    expect(normalized.properties.count).not.toHaveProperty('nullable');
    expect(normalized.properties.count).not.toHaveProperty('anyOf');
  });

  it('중첩 객체/배열의 nullable도 정규화해야 한다', () => {
    const input = {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          properties: {
            nickname: { type: 'string', nullable: true },
          },
        },
        tags: {
          type: 'array',
          items: { type: 'string', nullable: true },
        },
      },
    };

    const normalized = normalizeOpenApiDocumentForAjv(input) as unknown as {
      properties: {
        profile: { properties: { nickname: unknown } };
        tags: { items: unknown };
      };
    };

    expect(normalized.properties.profile.properties.nickname).toMatchObject({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
    expect(normalized.properties.tags.items).toMatchObject({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
  });

  it('shared reference가 여러 경로에서 일관되게 정규화되어야 한다', () => {
    const shared = { type: 'string', nullable: true };
    const input = {
      type: 'object',
      properties: {
        first: shared,
        second: shared,
      },
    };

    const normalized = normalizeOpenApiDocumentForAjv(input) as unknown as {
      properties: { first: unknown; second: unknown };
    };

    expect(normalized.properties.first).toMatchObject({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
    expect(normalized.properties.second).toMatchObject({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
  });

  it('기존 anyOf/oneOf가 있으면 중첩 래핑 없이 null만 추가해야 한다', () => {
    const input = {
      type: 'object',
      properties: {
        withAnyOf: {
          nullable: true,
          anyOf: [{ type: 'string' }, { type: 'integer' }],
        },
        withOneOf: {
          nullable: true,
          oneOf: [{ type: 'string' }, { type: 'integer' }],
        },
      },
    };

    const normalized = normalizeOpenApiDocumentForAjv(input) as unknown as {
      properties: {
        withAnyOf: { anyOf: Array<{ type: string }> };
        withOneOf: { oneOf: Array<{ type: string }> };
      };
    };

    expect(normalized.properties.withAnyOf.anyOf).toHaveLength(3);
    expect(
      normalized.properties.withAnyOf.anyOf.some(
        (entry) => entry.type === 'null',
      ),
    ).toBe(true);
    expect(normalized.properties.withOneOf.oneOf).toHaveLength(3);
    expect(
      normalized.properties.withOneOf.oneOf.some(
        (entry) => entry.type === 'null',
      ),
    ).toBe(true);
  });
});
