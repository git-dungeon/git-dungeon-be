import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  it('요청에 포함된 UUID 요청 ID를 재사용해야 한다', () => {
    const middleware = new RequestContextMiddleware();
    const incomingId = '7e96e8ab-41a2-4d18-9eed-4f7125341e52';
    const request = {
      header: (name: string) =>
        name === 'x-request-id' ? incomingId : undefined,
    } as unknown as Request & { id?: string };
    const response = createResponse();

    middleware.use(request, response, () => {});

    expect(request.id).toBe(incomingId);
    expect(response.headers['x-request-id']).toBe(incomingId);
  });

  it('UUID가 아닌 요청 ID는 무시하고 새 UUID를 생성해야 한다', () => {
    const middleware = new RequestContextMiddleware();
    const request = {
      header: (name: string) =>
        name === 'x-request-id' ? 'incoming-id' : undefined,
    } as unknown as Request & { id?: string };
    const response = createResponse();

    middleware.use(request, response, () => {});

    expect(request.id).toBeDefined();
    expect(request.id).not.toBe('incoming-id');
    expect(request.id).toMatch(UUID_REGEX);
    expect(response.headers['x-request-id']).toBe(request.id);
  });

  it('요청 ID가 없으면 새로 생성해야 한다', () => {
    const middleware = new RequestContextMiddleware();
    const request = {
      header: () => undefined,
    } as unknown as Request & { id?: string };
    const response = createResponse();

    middleware.use(request, response, () => {});

    expect(request.id).toBeDefined();
    expect(request.id).toMatch(UUID_REGEX);
    expect(response.headers['x-request-id']).toBe(request.id);
  });
});
