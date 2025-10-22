import type { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
import { NoTransformConfigurationError } from '@nestia/core/lib/decorators/NoTransformConfigurationError.js';

type AppModuleConstructor = typeof import('../src/app.module.js').AppModule;

const config: INestiaConfig = {
  input: async () => {
    NoTransformConfigurationError.throws = false;
    const moduleUrl = new URL('../dist/app.module.js', import.meta.url);
    const { AppModule } = (await import(moduleUrl.href)) as {
      AppModule: AppModuleConstructor;
    };
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
