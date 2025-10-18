import {
  CallHandler,
  ExecutionContext,
  Injectable,
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
      map((data) =>
        successResponse(data, {
          requestId: request?.id,
          generatedAt: new Date().toISOString(),
        }),
      ),
    );
  }
}
