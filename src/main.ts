import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger as NestLogger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { NestiaSwaggerComposer } from '@nestia/sdk';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { Auth } from 'better-auth';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { BETTER_AUTH_TOKEN } from './auth/auth.constants';
import { createBetterAuthExpressMiddleware } from './auth/utils/better-auth-express.util';

async function bootstrap() {
  const bootstrapLogger = new NestLogger('Bootstrap');
  let app: INestApplication | undefined;
  let appLogger: PinoLogger | undefined;

  try {
    app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    const logger = app.get(PinoLogger);
    appLogger = logger;
    app.useLogger(logger);
    app.enableShutdownHooks();

    registerShutdownSignals(app, logger);

    const config = app.get(ConfigService);
    const port = config.get<number>('app.port') ?? 3000;
    const corsAllowedOrigins =
      config.get<string[]>('app.cors.allowedOrigins') ?? [];
    const corsAllowCredentials =
      config.get<boolean>('app.cors.allowCredentials') ?? true;
    const shouldAllowAnyOrigin = corsAllowedOrigins.includes('*');

    app.enableCors({
      origin: shouldAllowAnyOrigin
        ? true
        : corsAllowedOrigins.length > 0
          ? corsAllowedOrigins
          : false,
      credentials: corsAllowCredentials,
    });

    const raiseBetterAuthError = (reason: string, err?: unknown): never => {
      const message = `[BetterAuth] ${reason}`;
      const stackTrace = err instanceof Error ? err.stack : undefined;
      bootstrapLogger.error(message, stackTrace);
      logger.error(
        {
          err: err instanceof Error ? err : undefined,
        },
        message,
      );
      throw new Error(message);
    };

    const betterAuth = (() => {
      try {
        return app.get<Auth<any>>(BETTER_AUTH_TOKEN);
      } catch (error) {
        return raiseBetterAuthError(
          'missing provider: BETTER_AUTH_TOKEN is not bound',
          error,
        );
      }
    })();

    if (typeof betterAuth.handler !== 'function') {
      raiseBetterAuthError('missing handler on BetterAuth instance');
    }

    const httpAdapter = app.getHttpAdapter();
    if (!httpAdapter) {
      raiseBetterAuthError('HTTP adapter is not available');
    }

    if (httpAdapter.getType?.() !== 'express') {
      raiseBetterAuthError('HTTP adapter is not Express-compatible');
    }

    const isExpressInstance = (instance: unknown): instance is Express => {
      return (
        typeof instance === 'function' &&
        typeof (instance as Express).use === 'function'
      );
    };

    const rawInstance: unknown = httpAdapter.getInstance?.();
    if (!isExpressInstance(rawInstance)) {
      raiseBetterAuthError('Express instance could not be resolved');
    }

    const expressInstance = rawInstance as Express;

    const middleware = createBetterAuthExpressMiddleware(betterAuth.handler);
    let middlewareMounted = false;

    try {
      expressInstance.use('/api/auth', middleware);
      middlewareMounted = true;
    } catch (error) {
      raiseBetterAuthError('failed to mount BetterAuth middleware', error);
    }

    if (!middlewareMounted) {
      raiseBetterAuthError('middleware mounting exited without completion');
    }

    // Setup Swagger UI at runtime
    try {
      const document = await NestiaSwaggerComposer.document(app, {
        openapi: '3.1',
        servers: [
          {
            url: `http://localhost:${port}`,
            description: 'Local Server',
          },
        ],
      });
      SwaggerModule.setup('api', app, document as any);
      logger.log(
        'Swagger UI is available at http://localhost:' + port + '/api',
      );
    } catch (error) {
      logger.warn('Failed to generate Swagger documentation:', error);
    }

    await app.listen(port);
    logger.log(`Server is running on http://localhost:${port}`);
  } catch (error) {
    const stack = error instanceof Error ? error.stack : undefined;
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    bootstrapLogger.error(`Failed to bootstrap application: ${message}`, stack);
    console.error('[Bootstrap] Failed to bootstrap application:', message);
    if (stack) {
      console.error(stack);
    }

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

    if (appLogger) {
      await flushApplicationLogger(appLogger).catch((flushError) => {
        const flushStack =
          flushError instanceof Error ? flushError.stack : undefined;
        bootstrapLogger.warn(
          'Failed to flush application logger before exit',
          flushStack,
        );
        console.warn(
          '[Bootstrap] Failed to flush application logger before exit',
          flushError,
        );
      });
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
      await flushApplicationLogger(logger);
      process.exit(0);
    } catch (error) {
      logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
        },
        'Error during application shutdown.',
      );
      await flushApplicationLogger(logger).catch(() => undefined);
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

async function flushApplicationLogger(logger: PinoLogger): Promise<void> {
  // Pino logger를 강제로 flush하여 종료 직전 로그 유실을 방지한다.
  const firstLevel = (logger as unknown as { logger?: unknown }).logger;
  const secondLevel = (firstLevel as { logger?: unknown })?.logger;
  const target = secondLevel ?? firstLevel ?? logger;

  const flush = (target as { flush?: () => Promise<void> }).flush;
  if (typeof flush !== 'function') {
    return;
  }

  await flush.call(target);
}
