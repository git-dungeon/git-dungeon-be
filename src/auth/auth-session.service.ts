import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { APIError } from 'better-auth';
import type { Auth } from 'better-auth';
import { getCookies } from 'better-auth/cookies';
import { Prisma } from '@prisma/client';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { loadEnvironment } from '../config/environment';
import { buildForwardHeaders } from './utils/request-forward.util';
import { collectSetCookies } from './utils/set-cookie.util';
import {
  AuthSessionExpiredException,
  AuthSessionInvalidException,
} from './errors/auth-session.exception';
import { PrismaService } from '../prisma/prisma.service';

type GitDungeonAuth = Auth<any>;

interface SessionPayload {
  session: Record<string, unknown>;
  user: Record<string, unknown>;
}

export interface AuthSessionUserView {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
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
  domain?: string;
}

@Injectable()
export class AuthSessionService {
  private readonly cookieNames: {
    sessionToken: string;
    sessionData: string;
    dontRememberToken: string;
  };
  private readonly initialAp: number;
  private readonly skipDatabase: boolean;

  constructor(
    @Inject(BETTER_AUTH_TOKEN) private readonly betterAuth: GitDungeonAuth,
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const cookies = this.getBetterAuthCookies();
    this.cookieNames = {
      sessionToken: cookies.sessionToken.name,
      sessionData: cookies.sessionData.name,
      dontRememberToken: cookies.dontRememberToken.name,
    };

    const fallbackEnv = this.configService ? undefined : loadEnvironment();

    this.initialAp = this.configService
      ? (this.configService.get<number>('dungeon.initialAp', 10) ?? 10)
      : (fallbackEnv?.dungeonInitialAp ?? 10);

    this.skipDatabase = this.configService
      ? (this.configService.get<boolean>('database.skipConnection', false) ??
        false)
      : (fallbackEnv?.databaseSkipConnection ??
        (fallbackEnv?.nodeEnv ?? '').toLowerCase() === 'test');
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
    const view = this.buildSessionView(payload, refreshed);

    await this.ensureDungeonStateOnFirstLogin(view.session.userId);

    return {
      payload,
      cookies,
      refreshed,
      view,
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
    const cookies = this.getBetterAuthCookies();

    const sessionCookies = [
      cookies.sessionToken,
      cookies.sessionData,
      cookies.dontRememberToken,
    ].filter((cookie): cookie is (typeof cookies)['sessionToken'] =>
      Boolean(cookie),
    );

    return sessionCookies.map((cookie) => ({
      name: cookie.name,
      httpOnly: cookie.options.httpOnly ?? true,
      sameSite: cookie.options.sameSite as string | undefined,
      secure: cookie.options.secure,
      path: cookie.options.path,
      domain: cookie.options.domain,
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
        username: username ?? '',
        displayName: displayName ?? '',
        email: email ?? '',
        avatarUrl: avatarUrl ?? '',
      },
      refreshed,
    };
  }

  private async ensureDungeonStateOnFirstLogin(userId: string): Promise<void> {
    if (this.skipDatabase) {
      return;
    }

    if (!this.prisma) {
      throw new Error('[AuthSessionService] PrismaService is not available.');
    }

    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }

    const existing = await this.prisma.dungeonState.findUnique({
      where: { userId: normalizedUserId },
      select: { userId: true },
    });

    if (existing) {
      return;
    }

    try {
      await this.prisma.dungeonState.create({
        data: { userId: normalizedUserId, ap: this.initialAp },
      });
    } catch (error) {
      const isUnique =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (isUnique) {
        return;
      }

      throw error;
    }
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

  private getBetterAuthCookies() {
    return getCookies(
      this.betterAuth.options as Parameters<typeof getCookies>[0],
    );
  }
}
