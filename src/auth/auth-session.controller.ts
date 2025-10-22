import {
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { TypedRoute } from '@nestia/core';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor.js';
import { AuthSessionService } from './auth-session.service.js';
import type {
  ActiveSessionResult,
  AuthSessionView,
} from './auth-session.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import type { AuthenticatedRequest } from './auth-session.request.js';

@Controller('api/auth')
@UseInterceptors(ApiResponseInterceptor)
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @TypedRoute.Get('session')
  @UseGuards(AuthGuard)
  getSession(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): AuthSessionView {
    const session = this.readSession(request);

    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    return session.view;
  }

  private readSession({
    authSession,
  }: AuthenticatedRequest): ActiveSessionResult {
    if (!authSession) {
      throw new InternalServerErrorException({
        code: 'AUTH_SESSION_GUARD_MISSING',
        message: 'AuthGuard가 활성 세션을 주입하지 않았습니다.',
      });
    }

    return authSession;
  }

  @TypedRoute.Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    this.readSession(request);
    const result = await this.authSessionService.signOut(request);

    this.applyNoCacheHeaders(response);
    this.appendCookies(response, result.cookies);
    this.clearSessionCookies(response);

    return {
      success: true,
    };
  }

  private applyNoCacheHeaders(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
  }

  private appendCookies(response: Response, cookies: string[]): void {
    for (const cookie of cookies) {
      response.append('Set-Cookie', cookie);
    }
  }

  private clearSessionCookies(response: Response): void {
    const cookies = this.authSessionService.describeSessionCookies();
    for (const cookie of cookies) {
      const options: CookieOptions = {
        httpOnly: cookie.httpOnly,
        sameSite: this.normalizeSameSite(cookie.sameSite),
        secure: cookie.secure,
        path: cookie.path ?? '/',
        expires: new Date(0),
        maxAge: 0,
      };

      if (cookie.domain) {
        options.domain = cookie.domain;
      }

      response.cookie(cookie.name, '', options);
    }
  }

  private normalizeSameSite(
    sameSite: string | undefined,
  ): 'lax' | 'strict' | 'none' | boolean | undefined {
    if (!sameSite) {
      return undefined;
    }

    const normalized = sameSite.toLowerCase();
    if (
      normalized === 'lax' ||
      normalized === 'strict' ||
      normalized === 'none'
    ) {
      return normalized;
    }

    return undefined;
  }
}
