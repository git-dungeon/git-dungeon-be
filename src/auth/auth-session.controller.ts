import {
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { TypedRoute } from '@nestia/core';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';
import { AuthSessionService } from './auth-session.service';
import type {
  ActiveSessionResult,
  AuthSessionView,
} from './auth-session.service';
import { Authenticated } from './decorators/authenticated.decorator';
import { CurrentAuthSession } from './decorators/current-auth-session.decorator';
import type { AuthenticatedRequest } from './auth-session.request';

@Controller('api/auth')
@UseInterceptors(ApiResponseInterceptor)
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @TypedRoute.Get('session')
  @Authenticated()
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
  @Authenticated()
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

  @TypedRoute.Get('whoami')
  @Authenticated()
  whoAmI(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Res({ passthrough: true }) response: Response,
  ): { username: string | null } {
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    return {
      username: session.view.session.username,
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
