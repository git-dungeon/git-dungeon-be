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
});
