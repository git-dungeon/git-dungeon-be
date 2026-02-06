import { describe, expect, it } from 'vitest';
import { buildIndexKey, type OperationIndex } from './openapi-operation-index';
import { OpenApiRequestValidator } from './request-validator';

describe('OpenApiRequestValidator', () => {
  it('일부 스키마 compile 실패가 다른 스키마 검증을 막지 않아야 한다', () => {
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

    const warnings: string[] = [];
    const validator = new OpenApiRequestValidator(index, {
      warn: (message) => warnings.push(message),
    });

    const paramsResult = validator.validateParams(spec, { id: '1' });
    const bodyResult = validator.validateBody(spec, {});

    expect(paramsResult.ok).toBe(true);
    expect(bodyResult.ok).toBe(false);
    expect(warnings.some((message) => message.includes('(params)'))).toBe(true);
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
