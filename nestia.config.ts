import type { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
import { NoTransformConfigurationError } from '@nestia/core/lib/decorators/NoTransformConfigurationError.js';
import { AppModule } from './src/app.module';

const config: INestiaConfig = {
  input: async () => {
    NoTransformConfigurationError.throws = false;
    const app = await NestFactory.create(AppModule, {
      logger: false,
    });
    await app.init();
    return app;
  },
  output: 'generated/sdk',
  swagger: {
    output: 'generated/swagger.json',
    beautify: true,
  },
  primitive: true,
};

export default config;
