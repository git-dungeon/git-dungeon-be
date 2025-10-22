import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
import { NoTransformConfigurationError } from '@nestia/core/lib/decorators/NoTransformConfigurationError.js';
import type { AppModule } from '../src/app.module';

type AppModuleConstructor = typeof AppModule;

const APP_MODULE_PATH = path.resolve(__dirname, '../dist/app.module.js');

const isAppModuleConstructor = (
  value: unknown,
): value is AppModuleConstructor => typeof value === 'function';

const loadAppModule = async (): Promise<AppModuleConstructor> => {
  const moduleUrl = pathToFileURL(APP_MODULE_PATH);
  const moduleExports = (await import(moduleUrl.href)) as Record<
    string,
    unknown
  >;
  const candidate = moduleExports.AppModule;
  if (!isAppModuleConstructor(candidate)) {
    throw new Error('AppModule export not found');
  }
  return candidate;
};

const config: INestiaConfig = {
  input: async () => {
    NoTransformConfigurationError.throws = false;
    const AppModule = await loadAppModule();
    const app = await NestFactory.create(AppModule, {
      logger: false,
    });
    await app.init();
    return app;
  },
  output: 'generated/sdk',
  swagger: {
    output: 'generated/swagger.json',
  },
  primitive: true,
};

export default config;
