import type { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
import { NoTransformConfigurationError } from '@nestia/core/lib/decorators/NoTransformConfigurationError.js';

const config: INestiaConfig = {
  input: async () => {
    NoTransformConfigurationError.throws = false;
    const { AppModule } = await import('../dist/app.module.js');
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
