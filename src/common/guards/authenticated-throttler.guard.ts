import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { ActiveSessionResult } from '../../auth/auth-session.service';

export interface RateLimitConfig {
  code: string;
  message: string;
}

export const RATE_LIMIT_CONFIG = Symbol('RATE_LIMIT_CONFIG');

@Injectable()
export class AuthenticatedThrottlerGuard extends ThrottlerGuard {
  @Inject(RATE_LIMIT_CONFIG)
  protected readonly rateLimitConfig!: RateLimitConfig;

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request & {
      authSession?: ActiveSessionResult;
    };

    const userId = request.authSession?.view.session.userId;
    const requestIdHeader = request.header('x-request-id');
    const tracker = userId ?? request.ip ?? requestIdHeader ?? randomUUID();

    return Promise.resolve(tracker);
  }

  protected throwThrottlingException(): never {
    throw new HttpException(
      {
        error: {
          code: this.rateLimitConfig.code,
          message: this.rateLimitConfig.message,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
