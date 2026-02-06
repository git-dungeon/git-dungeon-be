import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthSessionService } from './auth-session.service';
import type {
  ActiveSessionResult,
  AuthSessionView,
} from './auth-session.service';
import { Authenticated } from './decorators/authenticated.decorator';
import { CurrentAuthSession } from './decorators/current-auth-session.decorator';
import type { AuthenticatedRequest } from './auth-session.request';
import {
  successResponse,
  type ApiSuccessResponse,
} from '../common/http/api-response';
import type { ApiResponseMeta } from '../common/http/api-response';

type TrackedAuthenticatedRequest = AuthenticatedRequest & { id?: string };

@Controller('api/auth')
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Get('session')
  @Authenticated()
  getSession(
    @Req() request: TrackedAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): ApiSuccessResponse<AuthSessionView> {
    const session = this.readSession(request);

    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    return successResponse(session.view, this.buildMeta(request));
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

  @Post('logout')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: TrackedAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<{ success: boolean }>> {
    this.readSession(request);
    const result = await this.authSessionService.signOut(request);

    this.applyNoCacheHeaders(response);
    this.appendCookies(response, result.cookies);
    this.clearSessionCookies(response);

    return successResponse(
      { success: result.success },
      this.buildMeta(request),
    );
  }

  @Get('whoami')
  @Authenticated()
  whoAmI(
    @CurrentAuthSession() session: ActiveSessionResult,
    @Req() request: TrackedAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): ApiSuccessResponse<{ username: string | null }> {
    this.applyNoCacheHeaders(response);
    this.appendCookies(response, session.cookies);

    return successResponse(
      { username: session.view.session.username },
      this.buildMeta(request),
    );
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

  private buildMeta(request: { id?: string }): ApiResponseMeta {
    return {
      requestId: request.id,
      generatedAt: new Date().toISOString(),
    };
  }
}
