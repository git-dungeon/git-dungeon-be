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

describe('RequestContextMiddleware', () => {
  it('should reuse incoming request id', () => {
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

  it('should generate request id when missing', () => {
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
