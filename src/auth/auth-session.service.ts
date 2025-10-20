import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Auth } from 'better-auth';
import { getCookies } from 'better-auth/cookies';
import { BETTER_AUTH_TOKEN } from './auth.constants.js';
import { buildForwardHeaders } from './utils/request-forward.util.js';
import { collectSetCookies } from './utils/set-cookie.util.js';
import {
  AuthSessionExpiredException,
  AuthSessionInvalidException,
} from './errors/auth-session.exception.js';

type GitDungeonAuth = Auth<any>;

interface SessionPayload {
  session: Record<string, unknown>;
  user: Record<string, unknown>;
}

export interface ActiveSessionResult {
  payload: SessionPayload;
  cookies: string[];
  refreshed: boolean;
}

export interface SessionCookieDescriptor {
  name: string;
  httpOnly: boolean;
  sameSite?: string;
  secure?: boolean;
  path?: string;
}

@Injectable()
export class AuthSessionService {
  private readonly cookieNames: {
    sessionToken: string;
    sessionData: string;
    dontRememberToken: string;
  };

  constructor(
    @Inject(BETTER_AUTH_TOKEN) private readonly betterAuth: GitDungeonAuth,
  ) {
    const cookies = getCookies(this.betterAuth.options);
    this.cookieNames = {
      sessionToken: cookies.sessionToken.name,
      sessionData: cookies.sessionData.name,
      dontRememberToken: cookies.dontRememberToken.name,
    };
  }

  async getSession(
    request: Request,
    options: { disableRefresh?: boolean; disableCookieCache?: boolean } = {},
  ): Promise<ActiveSessionResult | null> {
    const headers = buildForwardHeaders(request);
    const { response, headers: responseHeaders } =
      await this.betterAuth.api.getSession({
        headers,
        returnHeaders: true,
        query: {
          disableRefresh: options.disableRefresh ?? false,
          disableCookieCache: options.disableCookieCache ?? false,
        },
      });

    if (!response) {
      return null;
    }

    const cookies = collectSetCookies(responseHeaders);
    return {
      payload: response as SessionPayload,
      cookies,
      refreshed: cookies.length > 0,
    };
  }

  async requireActiveSession(request: Request): Promise<ActiveSessionResult> {
    const result = await this.getSession(request);
    if (result) {
      return result;
    }

    if (this.hasSessionCookie(request)) {
      throw new AuthSessionExpiredException();
    }

    throw new AuthSessionInvalidException();
  }

  describeSessionCookies(): SessionCookieDescriptor[] {
    const cookies = getCookies(this.betterAuth.options);

    return [cookies.sessionToken, cookies.sessionData].map((cookie) => ({
      name: cookie.name,
      httpOnly: cookie.options.httpOnly ?? true,
      sameSite: cookie.options.sameSite as string | undefined,
      secure: cookie.options.secure,
      path: cookie.options.path,
    }));
  }

  private hasSessionCookie(request: Request): boolean {
    const cookieHeader = request.get('cookie');
    if (!cookieHeader) {
      return false;
    }

    const tokens = cookieHeader.split(';');
    const targetNames = new Set([
      this.cookieNames.sessionToken,
      this.cookieNames.sessionData,
      this.cookieNames.dontRememberToken,
    ]);

    return tokens.some((token) => {
      const [name] = token.split('=').map((value) => value.trim());
      return targetNames.has(name ?? '');
    });
  }
}
