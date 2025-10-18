import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { successResponse } from '../http/api-response.js';
import type { ApiResponse } from '../http/api-response.js';
import type { Request } from 'express';

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  private readonly logger = new Logger(ApiResponseInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    if (context.getType() !== 'http') {
      return next.handle() as unknown as Observable<ApiResponse<T>>;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string }>();

    return next.handle().pipe(
      map((data) => {
        const normalized = this.normalizeData(data, request);

        return successResponse(normalized, {
          requestId: request?.id,
          generatedAt: new Date().toISOString(),
        });
      }),
    );
  }

  private normalizeData(
    data: T,
    request: (Request & { id?: string }) | undefined,
  ): T {
    if (typeof data === 'string') {
      if (data.trim().length === 0) {
        return data;
      }

      try {
        const parsed: unknown = JSON.parse(data);

        if (typeof parsed === 'string') {
          return data;
        }

        this.logger.warn({
          message:
            'Stringified JSON payload detected. Consider returning objects instead.',
          requestId: request?.id,
          path: request?.url,
        });

        return parsed as T;
      } catch (error) {
        this.logger.warn({
          message: 'Failed to parse string response as JSON.',
          requestId: request?.id,
          path: request?.url,
          error: error instanceof Error ? error.message : String(error),
        });

        return data;
      }
    }

    return data;
  }
}
