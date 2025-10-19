import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware.js';

const createResponse = () => {
  const headers: Record<string, string> = {};
  return {
    setHeader: (key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    },
    headers,
  } as unknown as Response & { headers: Record<string, string> };
};

describe('RequestContextMiddleware 테스트', () => {
  it('요청에 포함된 ID를 재사용해야 한다', () => {
    const middleware = new RequestContextMiddleware();
    const request = {
      header: (name: string) =>
        name === 'x-request-id' ? 'incoming-id' : undefined,
    } as unknown as Request & { id?: string };
    const response = createResponse();

    middleware.use(request, response, () => {});

    expect(request.id).toBe('incoming-id');
    expect(response.headers['x-request-id']).toBe('incoming-id');
  });

  it('요청 ID가 없으면 새로 생성해야 한다', () => {
    const middleware = new RequestContextMiddleware();
    const request = {
      header: () => undefined,
    } as unknown as Request & { id?: string };
    const response = createResponse();

    middleware.use(request, response, () => {});

    expect(request.id).toBeDefined();
    expect(response.headers['x-request-id']).toBe(request.id);
  });
});
