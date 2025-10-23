import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

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

describe('ApiResponseInterceptor 테스트', () => {
  it('응답 데이터를 ApiResponse 형식으로 감싸야 한다', async () => {
    const interceptor = new ApiResponseInterceptor<{ status: string }>();
    const handler: CallHandler<{ status: string }> = {
      handle: () => of({ status: 'ok' }),
    };

    const httpContext = createHttpContext('req-1');

    const result = await firstValueFrom(
      interceptor.intercept(httpContext, handler),
    );

    if (!result.success) {
      throw new Error('성공 응답을 기대했습니다');
    }

    const data = result.data;
    const meta = result.meta;

    expect(data.status).toBe('ok');
    expect(meta.requestId).toBe('req-1');
    expect(typeof meta.generatedAt).toBe('string');
  });

  it('HTTP 컨텍스트가 아니면 그대로 통과시켜야 한다', async () => {
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
