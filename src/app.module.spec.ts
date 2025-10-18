import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('typia', () => ({
  __esModule: true,
  default: {
    assert: <T>(value: T) => value,
  },
  assert: <T>(value: T) => value,
}));

vi.mock('@nestia/core', async () => {
  const decorators = await import('@nestjs/common');

  const wrap =
    <T extends (...params: never[]) => unknown>(decorator: T) =>
    (...params: Parameters<T>): ReturnType<T> =>
      decorator(...params) as ReturnType<T>;

  return {
    __esModule: true,
    TypedRoute: {
      Get: wrap(decorators.Get),
      Post: wrap(decorators.Post),
      Put: wrap(decorators.Put),
      Patch: wrap(decorators.Patch),
      Delete: wrap(decorators.Delete),
    },
    TypedBody: wrap(decorators.Body),
    TypedParam: wrap(decorators.Param),
    TypedQuery: wrap(decorators.Query),
    TypedHeaders: wrap(decorators.Headers),
  } as const;
});

import { Logger } from 'nestjs-pino';

describe('AppModule', () => {
  it('should respond with health payload', async () => {
    const { AppModule } = await import('./app.module.js');
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(testingModule).toBeDefined();

    const app = testingModule.createNestApplication<NestExpressApplication>();
    app.useLogger(app.get(Logger));
    await app.init();

    const server = app.getHttpServer();
    const response = await request(server).get('/health');

    const body = response.body as unknown;

    const payload = body as {
      success: boolean;
      data?: { status: string; version: string; timestamp: string };
      meta?: { requestId: string; generatedAt: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);

    const data = payload.data;
    expect(data).toBeDefined();
    expect(data?.status).toBe('ok');
    expect(typeof data?.version).toBe('string');
    expect(typeof data?.timestamp).toBe('string');

    const meta = payload.meta;
    expect(meta).toBeDefined();
    expect(typeof meta?.requestId).toBe('string');
    expect(typeof meta?.generatedAt).toBe('string');
    expect('x-request-id' in response.headers).toBe(true);

    await app.close();
    await testingModule.close();
  });
});
