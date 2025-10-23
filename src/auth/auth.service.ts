import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { APIError } from 'better-auth';
import type { Auth } from 'better-auth';
import { AUTH_CONFIG_TOKEN, BETTER_AUTH_TOKEN } from './auth.constants';
import type { AuthConfig } from './auth.interfaces';
import {
  DEFAULT_REDIRECT_PATH,
  InvalidRedirectError,
  validateRedirectParam,
} from './utils/redirect.util';
import { buildForwardHeaders } from './utils/request-forward.util';
import { collectSetCookies } from './utils/set-cookie.util';

type GitDungeonAuth = Auth<any>;

interface StartGithubOAuthResult {
  location: string;
  cookies: string[];
}

interface InvokeBetterAuthOptions {
  request: Request;
  callbackURL: string;
  errorCallbackURL: string;
}

interface FinalizeGithubRedirectOptions {
  redirect?: string;
  origin?: string;
  error?: string;
  mode?: 'success' | 'error';
}

@Injectable()
export class AuthService {
  private static readonly PROVIDER_DENIED_ERRORS = new Set([
    'access_denied',
    'user_cancelled',
    'user_canceled',
  ]);

  private static readonly REDIRECT_VALIDATION_ERRORS = new Set([
    'state_mismatch',
    'invalid_callback_request',
    'please_restart_the_process',
    'no_code',
    'state_not_found',
  ]);

  private readonly backendOrigin: string;
  private readonly publicBaseUrl: string;

  constructor(
    @Inject(BETTER_AUTH_TOKEN) private readonly betterAuth: GitDungeonAuth,
    @Inject(AUTH_CONFIG_TOKEN) private readonly authConfig: AuthConfig,
  ) {
    this.backendOrigin = this.resolveBackendOrigin();
    this.publicBaseUrl = this.resolvePublicBaseUrl();
  }

  async startGithubOAuth(
    request: Request,
    redirect?: string,
  ): Promise<StartGithubOAuthResult> {
    const { value: redirectPath } = this.resolveRedirectOrThrow(redirect);
    const clientOrigin =
      this.resolveClientOrigin(request) ?? this.defaultClientOrigin();

    const callbackURL = this.buildBridgeURL({
      redirectPath,
      clientOrigin,
      mode: 'success',
    });
    const errorCallbackURL = this.buildBridgeURL({
      redirectPath,
      clientOrigin,
      mode: 'error',
    });

    const { headers, response } = await this.invokeBetterAuth({
      request,
      callbackURL,
      errorCallbackURL,
    });

    if (!response) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'GitHub OAuth provider returned an empty response.',
      });
    }

    if ('token' in response && response.redirect === false) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'Unexpected session payload returned from GitHub OAuth flow.',
      });
    }

    if (!response.redirect || !response.url) {
      throw new InternalServerErrorException({
        code: 'AUTH_PROVIDER_ERROR',
        message: 'GitHub OAuth redirect URL is missing.',
      });
    }

    return {
      location: response.url,
      cookies: collectSetCookies(headers),
    };
  }

  finalizeGithubRedirect({
    redirect,
    origin,
    error,
    mode,
  }: FinalizeGithubRedirectOptions): string {
    const redirectPath = this.resolveRedirectOrFallback(redirect);
    const originCandidate =
      this.normalizeClientOrigin(origin) ?? this.defaultClientOrigin();

    const target = new URL(redirectPath, originCandidate);
    const mappedError = this.mapProviderError(
      mode === 'error' ? (error ?? 'unknown') : undefined,
    );
    if (mappedError) {
      target.searchParams.set('authError', mappedError);
    }

    return target.toString();
  }

  private resolveRedirectOrThrow(redirect?: string) {
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

  private resolveRedirectOrFallback(redirect?: string): string {
    try {
      return validateRedirectParam(redirect).value;
    } catch {
      return DEFAULT_REDIRECT_PATH;
    }
  }

  private resolveClientOrigin(request: Request): string | undefined {
    const allowed = this.getAllowedClientOrigins();
    const originHeader = this.extractOrigin(request.get('origin'));
    if (originHeader && this.isOriginAllowed(originHeader, allowed)) {
      return originHeader;
    }

    const referer = this.extractOrigin(request.get('referer'));
    if (referer && this.isOriginAllowed(referer, allowed)) {
      return referer;
    }

    return undefined;
  }

  private normalizeClientOrigin(origin?: string): string | undefined {
    if (!origin) {
      return undefined;
    }

    const normalized = this.extractOrigin(origin);
    if (!normalized) {
      return undefined;
    }

    const allowed = this.getAllowedClientOrigins();
    return this.isOriginAllowed(normalized, allowed) ? normalized : undefined;
  }

  private defaultClientOrigin(): string {
    const allowed = this.getAllowedClientOrigins();
    if (allowed.length > 0) {
      return allowed[0];
    }

    return this.publicBaseUrl ?? this.backendOrigin;
  }

  private getAllowedClientOrigins(): string[] {
    return this.authConfig.redirect.allowedOrigins;
  }

  private extractOrigin(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      return new URL(value).origin;
    } catch {
      return undefined;
    }
  }

  private isOriginAllowed(origin: string, allowed: string[]): boolean {
    return allowed.includes(origin);
  }

  private buildBridgeURL({
    redirectPath,
    clientOrigin,
    mode,
  }: {
    redirectPath: string;
    clientOrigin?: string;
    mode: 'success' | 'error';
  }): string {
    const origin = this.publicBaseUrl ?? this.backendOrigin;
    const url = new URL('/auth/github/redirect', origin);
    url.searchParams.set('redirect', redirectPath);
    url.searchParams.set('mode', mode);
    if (clientOrigin) {
      url.searchParams.set('origin', clientOrigin);
    }

    return url.toString();
  }

  private async invokeBetterAuth({
    request,
    callbackURL,
    errorCallbackURL,
  }: InvokeBetterAuthOptions) {
    const headers = buildForwardHeaders(request);
    const signInSocial = this.betterAuth.api.signInSocial;

    try {
      return await signInSocial({
        body: {
          provider: 'github',
          callbackURL,
          errorCallbackURL,
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

  private mapProviderError(error?: string): string | undefined {
    if (!error) {
      return undefined;
    }

    const normalized = error.trim().toLowerCase();
    if (!normalized) {
      return 'AUTH_PROVIDER_ERROR';
    }

    if (AuthService.PROVIDER_DENIED_ERRORS.has(normalized)) {
      return 'AUTH_PROVIDER_DENIED';
    }

    if (AuthService.REDIRECT_VALIDATION_ERRORS.has(normalized)) {
      return 'AUTH_REDIRECT_INVALID';
    }

    return 'AUTH_PROVIDER_ERROR';
  }

  private resolveBackendOrigin(): string {
    try {
      return new URL(this.authConfig.github.redirectUri).origin;
    } catch {
      return 'http://localhost:3000';
    }
  }

  private resolvePublicBaseUrl(): string {
    try {
      return new URL(this.authConfig.publicBaseUrl).origin;
    } catch {
      return this.backendOrigin;
    }
  }
}
