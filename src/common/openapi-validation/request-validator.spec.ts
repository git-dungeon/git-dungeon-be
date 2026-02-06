import { describe, expect, it } from 'vitest';
import { buildIndexKey, type OperationIndex } from './openapi-operation-index';
import { OpenApiRequestValidator } from './request-validator';

describe('OpenApiRequestValidator', () => {
  it('스키마 compile 실패 시 즉시 예외를 던져야 한다', () => {
    const spec = {
      method: 'post' as const,
      path: '/api/sample',
      paramsSchema: {
        type: 'object',
        properties: {
          id: { type: 'invalid-type' },
        },
      },
      bodySchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    };
    const index: OperationIndex = new Map([
      [buildIndexKey(spec.method, spec.path), spec],
    ]);

    expect(() => {
      new OpenApiRequestValidator(index);
    }).toThrow(/compile failed/);
  });

  it('path template이 실제 경로와 매칭되어야 한다', () => {
    const spec = {
      method: 'get' as const,
      path: '/api/logs/{logId}',
    };
    const index: OperationIndex = new Map([
      [buildIndexKey(spec.method, spec.path), spec],
    ]);
    const validator = new OpenApiRequestValidator(index);

    const operation = validator.findOperation('GET', '/api/logs/abc123');

    expect(operation).toEqual(spec);
  });

  it('exact path 매칭이 template 매칭보다 우선되어야 한다', () => {
    const template = {
      method: 'get' as const,
      path: '/api/logs/{logId}',
    };
    const exact = {
      method: 'get' as const,
      path: '/api/logs/latest',
    };
    const index: OperationIndex = new Map([
      [buildIndexKey(template.method, template.path), template],
      [buildIndexKey(exact.method, exact.path), exact],
    ]);
    const validator = new OpenApiRequestValidator(index);

    const operation = validator.findOperation('GET', '/api/logs/latest');

    expect(operation).toEqual(exact);
  });
});
