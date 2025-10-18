import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger as NestLogger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const bootstrapLogger = new NestLogger('Bootstrap');
  let app: INestApplication | undefined;

  try {
    app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    const logger = app.get(PinoLogger);
    app.useLogger(logger);
    app.enableShutdownHooks();

    registerShutdownSignals(app, logger);

    const config = app.get(ConfigService);
    const port = config.get<number>('app.port') ?? 3000;

    await app.listen(port);
    logger.log(`Server is running on http://localhost:${port}`);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : undefined;
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    bootstrapLogger.error(`Failed to bootstrap application: ${message}`, stack);

    if (app) {
      try {
        await app.close();
      } catch (closeError) {
        const closeStack =
          closeError instanceof Error ? closeError.stack : undefined;
        bootstrapLogger.error(
          `Failed to close application after bootstrap error`,
          closeStack,
        );
      }
    }

    process.exit(1);
  }
}

function registerShutdownSignals(
  app: INestApplication,
  logger: PinoLogger,
): void {
  const shutdown = async (signal: NodeJS.Signals) => {
    logger.warn(`Received ${signal}. Shutting down...`);

    try {
      await app.close();
      logger.log('Application shutdown complete.');
      process.exit(0);
    } catch (error) {
      logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
        },
        'Error during application shutdown.',
      );
      process.exit(1);
    }
  };

  process.once('SIGINT', (signal) => {
    void shutdown(signal);
  });
  process.once('SIGTERM', (signal) => {
    void shutdown(signal);
  });
}

void bootstrap();
