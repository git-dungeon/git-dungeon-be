import {
  Controller,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { TypedRoute } from '@nestia/core';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor.js';
import { AuthSessionService } from './auth-session.service.js';
import type { AuthSessionView } from './auth-session.service.js';

@Controller('api/auth')
@UseInterceptors(ApiResponseInterceptor)
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @TypedRoute.Get('session')
  async getSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionView> {
    const session = await this.authSessionService.requireActiveSession(request);
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    return session.view;
  }

  @TypedRoute.Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.authSessionService.requireActiveSession(request);
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
