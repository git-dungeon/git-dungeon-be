import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { APIError } from 'better-auth';
import type { Auth } from 'better-auth';
import {
  AUTH_CONFIG_TOKEN,
  BETTER_AUTH_TOKEN,
  GITHUB_REDIRECT_COOKIE,
  REDIRECT_COOKIE_MAX_AGE,
} from './auth.constants.js';
import type { AuthConfig } from './auth.interfaces.js';
import {
  InvalidRedirectError,
  validateRedirectParam,
} from './utils/redirect.util.js';

type FetchHeaders = globalThis.Headers;
type GitDungeonAuth = Auth<any>;

interface HeadersWithRaw extends FetchHeaders {
  raw(): Record<string, string[]>;
}

type SignInSocialFn = (input: {
  body: {
    provider: 'github';
    callbackURL: string;
    disableRedirect: boolean;
    scopes?: string[];
  };
  headers: FetchHeaders;
  returnHeaders: true;
}) => Promise<{
  headers?: FetchHeaders;
  response: {
    url?: string;
    redirect?: boolean;
  };
}>;

interface GitHubOAuthOptions {
  redirect?: string;
  popup?: string;
  parent?: string;
}

interface GitHubOAuthResult {
  location: string;
  cookies: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(BETTER_AUTH_TOKEN) private readonly betterAuth: GitDungeonAuth,
    @Inject(AUTH_CONFIG_TOKEN) private readonly authConfig: AuthConfig,
  ) {}

  async startGithubOAuth(
    request: Request,
    options: GitHubOAuthOptions,
  ): Promise<GitHubOAuthResult> {
    const { redirect: redirectParam, popup, parent } = options;

    const { value: redirectPath } = this.resolveRedirect(redirectParam);
    const isPopup = this.isPopupMode(popup);
    const parentOrigin = this.normalizeParentOrigin(parent, request);

    const callbackURL = this.buildCallbackURL(redirectPath, {
      isPopup,
      parentOrigin,
    });

    const { headers, response } = await this.invokeBetterAuth(request, {
      callbackURL,
    });

    if (!response?.url) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'Failed to resolve GitHub authorization URL.',
      });
    }

    const cookies = this.collectCookies(headers);
    cookies.push(this.buildRedirectCookie(redirectPath, request));

    return {
      location: response.url,
      cookies,
    };
  }

  private resolveRedirect(redirect?: string) {
    try {
      return validateRedirectParam(redirect);
    } catch (error) {
      if (error instanceof InvalidRedirectError) {
        throw new BadRequestException({
          code: 'AUTH_REDIRECT_INVALID',
          message: 'Invalid redirect parameter.',
        });
      }

      throw error;
    }
  }

  private isPopupMode(popup?: string): boolean {
    if (!popup) {
      return false;
    }

    const normalized = popup.toLowerCase();
    return normalized === '1' || normalized === 'true';
  }

  private normalizeParentOrigin(
    parent: string | undefined,
    request: Request,
  ): string | undefined {
    if (!parent) {
      return undefined;
    }

    try {
      const parsed = new URL(parent);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return undefined;
      }

      const requestOrigin = this.getRequestOrigin(request);
      if (requestOrigin && parsed.origin !== requestOrigin) {
        return undefined;
      }

      return parsed.origin;
    } catch {
      return undefined;
    }
  }

  private getRequestOrigin(request: Request): string | undefined {
    const forwardedHost =
      request.get('x-forwarded-host') ?? request.get('x-original-host');
    const host = forwardedHost ?? request.get('host');
    if (!host) {
      return undefined;
    }

    const protoHeader = request.get('x-forwarded-proto');
    const protocol = protoHeader ?? (request.secure ? 'https' : 'http');

    const hostname = host.split(',')[0]?.trim();
    if (!hostname) {
      return undefined;
    }

    return `${protocol}://${hostname}`;
  }

  private buildCallbackURL(
    redirectPath: string,
    options: { isPopup: boolean; parentOrigin?: string },
  ): string {
    const callbackBase = this.authConfig.github.redirectUri;

    let url: URL;
    try {
      url = new URL(callbackBase);
    } catch {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'Invalid GitHub callback configuration.',
      });
    }

    url.searchParams.set('redirect', redirectPath);
    if (options.isPopup) {
      url.searchParams.set('popup', '1');
    }
    if (options.parentOrigin) {
      url.searchParams.set('parent', options.parentOrigin);
    }

    return url.toString();
  }

  private async invokeBetterAuth(
    request: Request,
    input: {
      callbackURL: string;
    },
  ) {
    const headers = this.buildForwardHeaders(request);
    const signInSocial = this.betterAuth.api
      .signInSocial as unknown as SignInSocialFn;

    try {
      return await signInSocial({
        body: {
          provider: 'github',
          callbackURL: input.callbackURL,
          disableRedirect: true,
          scopes: this.authConfig.github.scope,
        },
        headers,
        returnHeaders: true,
      });
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

  private buildForwardHeaders(request: Request): FetchHeaders {
    const headers = new globalThis.Headers();

    const append = (name: string) => {
      const value = request.get(name);
      if (value) {
        headers.set(name, value);
      }
    };

    append('user-agent');
    append('accept-language');
    append('x-forwarded-for');
    append('x-request-id');
    append('cookie');

    const host = request.get('host');
    if (host) {
      headers.set('host', host);
    }

    const forwardedHost = request.get('x-forwarded-host');
    if (forwardedHost) {
      headers.set('x-forwarded-host', forwardedHost);
    }

    const forwardedProto =
      request.get('x-forwarded-proto') ?? (request.secure ? 'https' : 'http');
    headers.set('x-forwarded-proto', forwardedProto);

    const origin = this.getRequestOrigin(request);
    if (origin) {
      headers.set('origin', origin);
      headers.set('referer', origin);
    }

    return headers;
  }

  private collectCookies(headers?: FetchHeaders): string[] {
    if (!headers) {
      return [];
    }

    try {
      const setCookieValues = headers.getSetCookie();
      if (Array.isArray(setCookieValues) && setCookieValues.length > 0) {
        return setCookieValues;
      }
    } catch {
      // 일부 런타임에서는 getSetCookie가 구현되지 않을 수 있으므로 무시한다.
    }

    if (this.hasRaw(headers)) {
      const data = headers.raw();
      const setCookie = data['set-cookie'];
      if (Array.isArray(setCookie)) {
        return setCookie;
      }
    }

    const single = headers.get('set-cookie');
    return typeof single === 'string' ? [single] : [];
  }

  private buildRedirectCookie(redirectPath: string, request: Request): string {
    const secure =
      request.secure ||
      (request.get('x-forwarded-proto') ?? '').toLowerCase().includes('https');

    const parts = [
      `${GITHUB_REDIRECT_COOKIE}=${encodeURIComponent(redirectPath)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${REDIRECT_COOKIE_MAX_AGE}`,
    ];

    if (secure) {
      parts.push('Secure');
    }

    return parts.join('; ');
  }

  private hasRaw(headers: FetchHeaders): headers is HeadersWithRaw {
    return typeof (headers as { raw?: unknown }).raw === 'function';
  }
}
