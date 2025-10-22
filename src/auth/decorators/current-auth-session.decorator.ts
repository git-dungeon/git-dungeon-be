import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ActiveSessionResult } from '../auth-session.service.js';
import type { AuthenticatedRequest } from '../auth-session.request.js';

export interface CurrentAuthSessionOptions {
  optional?: boolean;
}

const ensureHttpContext = (context: ExecutionContext): AuthenticatedRequest => {
  if (context.getType() !== 'http') {
    throw new InternalServerErrorException({
      code: 'AUTH_SESSION_DECORATOR_UNSUPPORTED_CONTEXT',
      message:
        'CurrentAuthSession 데코레이터는 HTTP 요청 컨텍스트에서만 사용할 수 있습니다.',
    });
  }

  const request = context.switchToHttp().getRequest<Request>();
  return request as AuthenticatedRequest;
};

export const resolveCurrentAuthSession = (
  context: ExecutionContext,
  options?: CurrentAuthSessionOptions,
): ActiveSessionResult | null => {
  const request = ensureHttpContext(context);
  const session = request.authSession;

  if (!session) {
    if (options?.optional) {
      return null;
    }

    throw new InternalServerErrorException({
      code: 'AUTH_SESSION_MISSING',
      message: 'AuthGuard가 활성 세션을 주입하지 않았습니다.',
    });
  }

  return session;
};

export const CurrentAuthSession = createParamDecorator<
  CurrentAuthSessionOptions | undefined,
  ActiveSessionResult | null
>((options, context) => resolveCurrentAuthSession(context, options));
