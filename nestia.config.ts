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
    servers: [
      {
        url: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV
          ? `${process.env.NODE_ENV.charAt(0).toUpperCase() + process.env.NODE_ENV.slice(1)} Server`
          : 'Development Server',
      },
    ],
  },
  primitive: true,
};

export default config;
