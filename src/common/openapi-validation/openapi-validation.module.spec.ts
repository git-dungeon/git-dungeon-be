import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  OpenApiValidationModule,
  resetOpenApiValidationCacheForTest,
} from './openapi-validation.module';

@Module({
  imports: [OpenApiValidationModule.forRoot()],
})
class OpenApiValidationTestAppModule {}

describe('OpenApiValidationModule', () => {
  const originalSpecPath = process.env.OPENAPI_SPEC_PATH;

  afterEach(() => {
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

  it('초기화 실패 시 앱 부팅을 중단해야 한다', async () => {
    process.env.OPENAPI_SPEC_PATH = '/tmp/__missing_openapi__.yaml';

    const app = await createApp();
    await expect(app.init()).rejects.toThrow();
    await app.close().catch(() => undefined);
  });
});
