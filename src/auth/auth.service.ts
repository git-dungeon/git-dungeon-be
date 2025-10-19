import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
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
import type {
  AuthConfig,
  GitHubPopupAuthRequest,
  GitHubPopupAuthResponse,
} from './auth.interfaces.js';
import {
  DEFAULT_REDIRECT_PATH,
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

type CallbackOAuthFn = (input: {
  method: 'POST';
  params: {
    id: 'github';
  };
  body: {
    code: string;
    state: string;
    device_id?: string;
    user?: string;
  };
  headers: FetchHeaders;
  returnHeaders: true;
}) => Promise<{
  headers?: FetchHeaders;
  response: unknown;
}>;

type GetSessionFn = (input: { headers: FetchHeaders }) => Promise<{
  session: {
    id: string;
    token: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
    emailVerified: boolean;
  };
} | null>;

interface GitHubOAuthOptions {
  redirect?: string;
  popup?: string;
  parent?: string;
}

interface GitHubOAuthResult {
  location: string;
  cookies: string[];
}

interface GitHubPopupAuthResult {
  payload: GitHubPopupAuthResponse;
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

  async completeGithubOAuth(
    request: Request,
    payload: GitHubPopupAuthRequest,
  ): Promise<GitHubPopupAuthResult> {
    const { code, state, error, errorDescription, deviceId, user } = payload;

    if (!state) {
      throw new BadRequestException({
        code: 'AUTH_REDIRECT_INVALID',
        message: 'Missing state parameter.',
      });
    }

    if (error) {
      throw new UnauthorizedException({
        code: 'AUTH_PROVIDER_DENIED',
        message: errorDescription ?? 'GitHub authorization was denied.',
        details: {
          provider: 'github',
          reason: error,
        },
      });
    }

    if (!code) {
      throw new UnauthorizedException({
        code: 'AUTH_PROVIDER_DENIED',
        message: 'Missing authorization code.',
      });
    }

    const callbackHeaders = this.buildForwardHeaders(request);
    const callbackOAuth = this.betterAuth.api
      .callbackOAuth as unknown as CallbackOAuthFn;

    let resolvedHeaders: FetchHeaders | undefined;

    try {
      const result = await callbackOAuth({
        method: 'POST',
        params: { id: 'github' },
        body: {
          code,
          state,
          device_id: deviceId,
          user,
        },
        headers: callbackHeaders,
        returnHeaders: true,
      });
      resolvedHeaders = result.headers;
    } catch (err) {
      const headersFromError = this.extractHeadersFromUnknown(err);
      if (headersFromError) {
        resolvedHeaders = headersFromError;
      } else if (err instanceof APIError) {
        throw new InternalServerErrorException({
          code: 'AUTH_PROVIDER_ERROR',
          message: 'GitHub OAuth provider returned an error.',
          details: {
            provider: 'github',
            reason: err.message,
          },
        });
      } else {
        throw err;
      }
    }

    if (!resolvedHeaders) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'Failed to finalize GitHub OAuth callback.',
      });
    }

    const cookies = this.collectCookies(resolvedHeaders);

    const sessionHeaders = this.buildForwardHeaders(request);
    const mergedCookie = this.mergeCookies(request.get('cookie'), cookies);
    if (mergedCookie) {
      sessionHeaders.set('cookie', mergedCookie);
    } else {
      sessionHeaders.delete('cookie');
    }

    const getSession = this.betterAuth.api
      .getSession as unknown as GetSessionFn;

    let sessionResult: Awaited<ReturnType<GetSessionFn>>;
    try {
      sessionResult = await getSession({
        headers: sessionHeaders,
      });
    } catch (err) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'Failed to retrieve session after GitHub OAuth callback.',
        details: {
          provider: 'github',
          reason: err instanceof Error ? err.message : String(err),
        },
      });
    }

    if (!sessionResult) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'GitHub OAuth session was not created.',
      });
    }

    const redirectPath = this.getRedirectFromCookies(request);
    const cleanupCookie = this.buildRedirectCleanupCookie(request);
    if (cleanupCookie) {
      cookies.push(cleanupCookie);
    }

    const popupPayload: GitHubPopupAuthResponse = {
      redirect: redirectPath,
      session: {
        userId: sessionResult.user.id,
        username:
          sessionResult.user.name?.trim() ??
          sessionResult.user.email?.split('@')[0] ??
          sessionResult.user.id,
        displayName:
          sessionResult.user.name?.trim() ??
          sessionResult.user.email ??
          sessionResult.user.id,
        avatarUrl: sessionResult.user.image ?? null,
      },
      accessToken: sessionResult.session.token,
    };

    return {
      cookies,
      payload: popupPayload,
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

  private getRedirectFromCookies(request: Request): string {
    const cookies = this.parseCookieHeader(request.get('cookie'));
    const raw = cookies.get(GITHUB_REDIRECT_COOKIE);
    if (!raw) {
      return DEFAULT_REDIRECT_PATH;
    }

    try {
      const decoded = decodeURIComponent(raw);
      return validateRedirectParam(decoded, DEFAULT_REDIRECT_PATH).value;
    } catch {
      return DEFAULT_REDIRECT_PATH;
    }
  }

  private mergeCookies(
    existingCookieHeader: string | undefined,
    setCookies: string[],
  ): string {
    const jar = this.parseCookieHeader(existingCookieHeader);

    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      if (!pair) continue;

      const separatorIndex = pair.indexOf('=');
      if (separatorIndex === -1) continue;

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1);

      if (!name) continue;
      jar.set(name, value);
    }

    return Array.from(jar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private parseCookieHeader(
    cookieHeader: string | undefined | null,
  ): Map<string, string> {
    const jar = new Map<string, string>();
    if (!cookieHeader) {
      return jar;
    }

    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const name = trimmed.slice(0, separatorIndex);
      const value = trimmed.slice(separatorIndex + 1);
      jar.set(name, value);
    }

    return jar;
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

  private buildRedirectCleanupCookie(request: Request): string | undefined {
    const cookies = this.parseCookieHeader(request.get('cookie'));
    if (!cookies.has(GITHUB_REDIRECT_COOKIE)) {
      return undefined;
    }

    const secure =
      request.secure ||
      (request.get('x-forwarded-proto') ?? '').toLowerCase().includes('https');

    const parts = [
      `${GITHUB_REDIRECT_COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
    ];

    if (secure) {
      parts.push('Secure');
    }

    return parts.join('; ');
  }

  private extractHeadersFromUnknown(input: unknown): FetchHeaders | undefined {
    if (
      typeof Response !== 'undefined' &&
      input instanceof Response &&
      input.headers
    ) {
      return input.headers;
    }

    if (
      input &&
      typeof input === 'object' &&
      'headers' in input &&
      (input as { headers?: unknown }).headers
    ) {
      const candidate = (input as { headers?: unknown }).headers;
      if (candidate instanceof Headers) {
        return candidate;
      }
      if (candidate && typeof (candidate as FetchHeaders).get === 'function') {
        return candidate as FetchHeaders;
      }
    }

    if (
      input &&
      typeof input === 'object' &&
      'response' in input &&
      (input as { response?: unknown }).response
    ) {
      const candidate = (input as { response?: unknown }).response;
      if (
        typeof Response !== 'undefined' &&
        candidate instanceof Response &&
        candidate.headers
      ) {
        return candidate.headers;
      }
    }

    return undefined;
  }

  private hasRaw(headers: FetchHeaders): headers is HeadersWithRaw {
    return typeof (headers as { raw?: unknown }).raw === 'function';
  }
}
