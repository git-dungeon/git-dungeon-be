import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { APIError } from 'better-auth';
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

export interface AuthSessionUserView {
  userId: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthSessionView {
  session: AuthSessionUserView;
  refreshed: boolean;
}

export interface ActiveSessionResult {
  payload: SessionPayload;
  cookies: string[];
  refreshed: boolean;
  view: AuthSessionView;
}

export interface SignOutResult {
  cookies: string[];
  success: boolean;
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
    const payload = response as SessionPayload;
    const refreshed = cookies.length > 0;

    return {
      payload,
      cookies,
      refreshed,
      view: this.buildSessionView(payload, refreshed),
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

  async signOut(request: Request): Promise<SignOutResult> {
    const headers = buildForwardHeaders(request);

    try {
      const { headers: responseHeaders, response } =
        await this.betterAuth.api.signOut({
          headers,
          returnHeaders: true,
        });

      return {
        cookies: collectSetCookies(responseHeaders),
        success: Boolean(
          (response as { success?: boolean } | undefined)?.success ?? true,
        ),
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw new InternalServerErrorException({
          code: 'AUTH_PROVIDER_ERROR',
          message: 'GitHub OAuth provider returned an error.',
          details: {
            provider: 'github',
            reason: error.message,
          },
        });
      }

      throw error;
    }
  }

  private buildSessionView(
    payload: SessionPayload,
    refreshed: boolean,
  ): AuthSessionView {
    const session = payload.session ?? {};
    const user = payload.user ?? {};

    const sessionUserId = this.readString(session, 'userId');
    const userId =
      sessionUserId ??
      this.readString(user, 'id') ??
      this.readString(user, 'userId') ??
      '';

    const username =
      this.readString(user, 'username') ??
      this.readString(user, 'login') ??
      this.readString(user, 'name');
    const displayName = this.readString(user, 'name');
    const email = this.readString(user, 'email');
    const avatarUrl = this.readString(user, 'image');

    return {
      session: {
        userId,
        username: username ?? null,
        displayName: displayName ?? null,
        email: email ?? null,
        avatarUrl: avatarUrl ?? null,
      },
      refreshed,
    };
  }

  private readString(
    source: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = source?.[key];
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
