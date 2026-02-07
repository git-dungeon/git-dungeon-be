import { describe, expect, it } from 'vitest';
import {
  buildIndexKey,
  buildOpenApiOperationIndex,
} from './openapi-operation-index';

describe('buildOpenApiOperationIndex', () => {
  it('operation-level parameter가 path-level parameter를 override해야 한다', () => {
    const document = {
      openapi: '3.1.0',
      info: { title: 'test', version: '0.0.0' },
      paths: {
        '/api/logs': {
          parameters: [
            {
              in: 'query',
              name: 'limit',
              required: true,
              schema: { type: 'integer', minimum: 1 },
            },
          ],
          get: {
            parameters: [
              {
                in: 'query',
                name: 'limit',
                required: false,
                schema: { type: 'integer', minimum: 0 },
              },
            ],
          },
        },
      },
    } as const;

    const index = buildOpenApiOperationIndex(
      document as Record<string, unknown>,
    );
    const spec = index.get(buildIndexKey('get', '/api/logs'));

    expect(spec).toBeDefined();
    expect(spec?.querySchema).toMatchObject({
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0 },
      },
    });
    expect(spec?.querySchema).not.toHaveProperty('required');
  });

  it('중복된 required 파라미터 이름은 한 번만 유지해야 한다', () => {
    const document = {
      openapi: '3.1.0',
      info: { title: 'test', version: '0.0.0' },
      paths: {
        '/api/ranking': {
          get: {
            parameters: [
              {
                in: 'query',
                name: 'season',
                required: true,
                schema: { type: 'string' },
              },
              {
                in: 'query',
                name: 'season',
                required: true,
                schema: { type: 'string' },
              },
            ],
          },
        },
      },
    } as const;

    const index = buildOpenApiOperationIndex(
      document as Record<string, unknown>,
    );
    const spec = index.get(buildIndexKey('get', '/api/ranking'));
    const required = (spec?.querySchema as { required?: string[] }).required;

    expect(required).toEqual(['season']);
  });
});
