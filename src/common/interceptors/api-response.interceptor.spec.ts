import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor.js';

type RequestStub = { id?: string } | undefined;

type ExecutionContextStub = ExecutionContext & {
  switchToHttp(): {
    getRequest(): RequestStub;
  };
};

const createHttpContext = (requestId?: string): ExecutionContextStub =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ id: requestId }),
    }),
  }) as ExecutionContextStub;

const createRpcContext = (): ExecutionContextStub =>
  ({
    getType: () => 'rpc',
    switchToHttp: () => ({
      getRequest: () => undefined,
    }),
  }) as ExecutionContextStub;

describe('ApiResponseInterceptor', () => {
  it('should wrap payload in ApiResponse format', async () => {
    const interceptor = new ApiResponseInterceptor<{ status: string }>();
    const handler: CallHandler<{ status: string }> = {
      handle: () => of({ status: 'ok' }),
    };

    const httpContext = createHttpContext('req-1');

    const result = await firstValueFrom(
      interceptor.intercept(httpContext, handler),
    );

    if (!result.success) {
      throw new Error('Expected success response');
    }

    const data = result.data;
    const meta = result.meta;

    expect(data.status).toBe('ok');
    expect(meta.requestId).toBe('req-1');
    expect(typeof meta.generatedAt).toBe('string');
  });

  it('should bypass non-http contexts', async () => {
    const interceptor = new ApiResponseInterceptor<string>();
    const handler: CallHandler<string> = {
      handle: () => of('raw'),
    };

    const rpcContext = createRpcContext();

    const result = await firstValueFrom(
      interceptor.intercept(rpcContext, handler),
    );

    expect(result).toBe('raw');
  });
});
