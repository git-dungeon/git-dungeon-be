import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { errorResponse } from '../http/api-response.js';
import type { ApiErrorBody } from '../http/api-response.js';
import { PinoLogger } from 'nestjs-pino';

const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly fallbackLogger = new Logger(HttpExceptionFilter.name);

  constructor(@Optional() private readonly logger?: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request?.id;
    const meta = {
      requestId,
      generatedAt: new Date().toISOString(),
    };

    const error: ApiErrorBody = this.normalizeError(exception);

    if (this.logger) {
      this.logger.error(
        {
          err: exception instanceof Error ? exception : undefined,
          requestId,
          path: request?.url,
        },
        error.message,
      );
    } else {
      this.fallbackLogger.error(
        { requestId, path: request?.url },
        error.message,
      );
    }

    response.status(status).json(errorResponse(error, meta));
  }

  private normalizeError(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return {
          code: exception.name,
          message: res,
        };
      }

      if (typeof res === 'object' && res) {
        if (
          'error' in res &&
          typeof (res as { error?: unknown }).error === 'object' &&
          (
            res as {
              error?: { code?: unknown; message?: unknown; details?: unknown };
            }
          ).error
        ) {
          const nested = (
            res as {
              error: { code?: unknown; message?: unknown; details?: unknown };
            }
          ).error;

          return {
            code:
              typeof nested.code === 'string' ? nested.code : exception.name,
            message:
              typeof nested.message === 'string' ? nested.message : 'Error',
            details: nested.details,
          };
        }

        const { error, message, code, ...details } = res as Record<
          string,
          unknown
        >;

        const detailKeys = Object.keys(details);
        const fallbackMessage =
          typeof message === 'string'
            ? message
            : typeof error === 'string'
              ? error
              : 'Error';

        return {
          code: typeof code === 'string' ? code : exception.name,
          message: fallbackMessage,
          details: detailKeys.length ? details : undefined,
        };
      }
    }

    if (exception instanceof Error) {
      return {
        code: DEFAULT_ERROR_CODE,
        message: IS_PRODUCTION
          ? 'Unexpected error occurred'
          : (exception.message ?? 'Unexpected error occurred'),
        details: IS_PRODUCTION
          ? undefined
          : this.sanitizeDetails({
              name: exception.name,
              message: exception.message,
            }),
      };
    }

    return {
      code: DEFAULT_ERROR_CODE,
      message: 'Unexpected error occurred',
      details: IS_PRODUCTION ? undefined : this.sanitizeDetails(exception),
    };
  }

  private sanitizeDetails(
    exception: unknown,
  ): Record<string, unknown> | undefined {
    if (!exception) {
      return undefined;
    }

    if (typeof exception === 'string') {
      return { message: exception };
    }

    if (typeof exception === 'number' || typeof exception === 'boolean') {
      return { value: exception };
    }

    if (typeof exception === 'object') {
      const entries = Object.entries(
        exception as Record<string, unknown>,
      ).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value === null
        ) {
          acc[key] = value;
        }

        return acc;
      }, {});

      return Object.keys(entries).length ? entries : undefined;
    }

    return undefined;
  }
}
