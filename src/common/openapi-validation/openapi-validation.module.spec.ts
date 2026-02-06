import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  OpenApiValidationModule,
  resetOpenApiValidationCacheForTest,
} from './openapi-validation.module';
import { OPENAPI_VALIDATION_RUNTIME } from './validation.middleware';

@Module({
  imports: [OpenApiValidationModule.forRoot()],
})
class OpenApiValidationTestAppModule {}

describe('OpenApiValidationModule', () => {
  const originalMode = process.env.OPENAPI_VALIDATION_MODE;
  const originalSpecPath = process.env.OPENAPI_SPEC_PATH;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.OPENAPI_VALIDATION_MODE;
    } else {
      process.env.OPENAPI_VALIDATION_MODE = originalMode;
    }
    if (originalSpecPath === undefined) {
      delete process.env.OPENAPI_SPEC_PATH;
    } else {
      process.env.OPENAPI_SPEC_PATH = originalSpecPath;
    }
    resetOpenApiValidationCacheForTest();
  });

  const createApp = async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OpenApiValidationTestAppModule],
    }).compile();
    return moduleRef.createNestApplication();
  };

  it('enforce 모드에서는 초기화 실패를 throw해야 한다', async () => {
    process.env.OPENAPI_VALIDATION_MODE = 'enforce';
    process.env.OPENAPI_SPEC_PATH = '/tmp/__missing_openapi__.yaml';

    const app = await createApp();
    await expect(app.init()).rejects.toThrow();
    await app.close().catch(() => undefined);
  });

  it('report 모드에서는 초기화 실패를 throw하지 않아야 한다', async () => {
    process.env.OPENAPI_VALIDATION_MODE = 'report';
    process.env.OPENAPI_SPEC_PATH = '/tmp/__missing_openapi__.yaml';

    const app = await createApp();
    await expect(app.init()).resolves.toBeDefined();
    const runtime = app.get<{
      mode?: string;
      validator?: unknown;
    }>(OPENAPI_VALIDATION_RUNTIME);

    expect(runtime.mode).toBe('report');
    expect(runtime.validator).toBeUndefined();
    await app.close();
  });

  it('off 모드에서는 스펙 로드 없이 초기화되어야 한다', async () => {
    process.env.OPENAPI_VALIDATION_MODE = 'off';
    process.env.OPENAPI_SPEC_PATH = '/tmp/__missing_openapi__.yaml';

    const app = await createApp();
    await expect(app.init()).resolves.toBeDefined();
    const runtime = app.get<{
      mode?: string;
      validator?: unknown;
    }>(OPENAPI_VALIDATION_RUNTIME);

    expect(runtime.mode).toBe('off');
    expect(runtime.validator).toBeUndefined();
    await app.close();
  });
});
