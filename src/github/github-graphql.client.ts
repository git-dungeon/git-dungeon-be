import { Inject, Injectable } from '@nestjs/common';
import { Octokit as CoreOctokit } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import {
  DEFAULT_GITHUB_GRAPHQL_BASE_BACKOFF_MS,
  DEFAULT_GITHUB_GRAPHQL_MAX_ATTEMPTS,
  DEFAULT_GITHUB_GRAPHQL_RATE_LIMIT_THRESHOLD,
  GITHUB_GRAPHQL_OPTIONS,
} from './github.constants';
import {
  FetchContributionsResult,
  FetchContributionsVariables,
  GithubGraphqlClientOptions,
  GithubGraphqlError,
  GithubOctokitInstance,
  GithubRateLimit,
  GithubTokenCandidate,
} from './github.interfaces';

const OctokitWithPlugins = CoreOctokit.plugin(throttling);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface OctokitErrorShape {
  status?: number;
  message?: string;
  response?: {
    headers?: Record<string, string | number | undefined>;
  };
}

const toOctokitError = (error: unknown): OctokitErrorShape => {
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  const err = error as Record<string, unknown>;
  const status = typeof err.status === 'number' ? err.status : undefined;
  const message = typeof err.message === 'string' ? err.message : undefined;
  const response =
    typeof err.response === 'object' && err.response !== null
      ? (err.response as {
          headers?: Record<string, string | number | undefined>;
        })
      : undefined;

  return { status, message, response };
};

@Injectable()
export class GithubGraphqlClient {
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly patToken: string | null;
  private readonly rateLimitThreshold: number;
  private readonly baseBackoffMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly octokitFactory?: (token: string) => GithubOctokitInstance;

  constructor(
    @Inject(GITHUB_GRAPHQL_OPTIONS)
    options: GithubGraphqlClientOptions,
  ) {
    this.endpoint = options.endpoint;
    this.userAgent = options.userAgent;
    this.patToken = options.patToken ?? null;
    this.rateLimitThreshold =
      options.rateLimitThreshold ?? DEFAULT_GITHUB_GRAPHQL_RATE_LIMIT_THRESHOLD;
    this.baseBackoffMs =
      options.baseBackoffMs ?? DEFAULT_GITHUB_GRAPHQL_BASE_BACKOFF_MS;
    this.maxAttempts =
      options.maxAttempts ?? DEFAULT_GITHUB_GRAPHQL_MAX_ATTEMPTS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.octokitFactory = options.octokitFactory;
  }

  async fetchContributions<TData = unknown>(
    accessToken: string | null | undefined,
    variables: FetchContributionsVariables,
  ): Promise<FetchContributionsResult<TData>> {
    const tokenQueue: GithubTokenCandidate[] = [];
    if (accessToken?.trim()) {
      tokenQueue.push({ token: accessToken.trim(), type: 'oauth' });
    }
    if (this.patToken?.trim()) {
      tokenQueue.push({ token: this.patToken.trim(), type: 'pat' });
    }

    if (tokenQueue.length === 0) {
      throw new GithubGraphqlError({
        code: 'UNAUTHORIZED',
        message: 'No GitHub token available for GraphQL request.',
      });
    }

    return this.executeWithRetry<TData>(tokenQueue, variables);
  }

  private createOctokit(token: string): GithubOctokitInstance {
    if (this.octokitFactory) {
      return this.octokitFactory(token);
    }

    const client = new OctokitWithPlugins({
      auth: token,
      userAgent: this.userAgent,
      request: {
        fetch: this.fetchImpl,
      },
      throttle: {
        onRateLimit: (retryAfter, _options, _octokit, retryCount) => {
          return retryCount < this.maxAttempts;
        },
        onSecondaryRateLimit: (_retryAfter, _options, _octokit, retryCount) => {
          return retryCount < this.maxAttempts;
        },
      },
    });

    const graphql = client.graphql.defaults({
      baseUrl: this.computeBaseUrl(),
    });

    return {
      graphql,
    };
  }

  private async executeWithRetry<TData>(
    tokenQueue: GithubTokenCandidate[],
    variables: FetchContributionsVariables,
  ): Promise<FetchContributionsResult<TData>> {
    let attempt = 0;
    let tokenIndex = 0;
    let backoffMs = this.baseBackoffMs;
    let lastRateLimit: GithubRateLimit | undefined;

    while (attempt < this.maxAttempts && tokenIndex < tokenQueue.length) {
      const candidate = tokenQueue[tokenIndex];
      try {
        const client = this.createOctokit(candidate.token);
        const result = (await client.graphql(this.buildContributionsQuery(), {
          ...variables,
        })) as unknown;
        const rateLimit = this.extractRateLimit(result);

        return {
          data: result as TData,
          rateLimit,
          tokenType: candidate.type,
        };
      } catch (error: unknown) {
        const parsed = toOctokitError(error);
        const status = parsed.status;
        const isRateLimit =
          status === 403 ||
          status === 429 ||
          (typeof parsed.message === 'string' &&
            parsed.message.toLowerCase().includes('rate limit'));

        if (isRateLimit) {
          lastRateLimit = this.parseRateLimit(parsed);

          if (tokenIndex + 1 < tokenQueue.length) {
            tokenIndex += 1;
            attempt += 1;
            await this.waitForResetOrBackoff(lastRateLimit, backoffMs);
            backoffMs *= 2;
            continue;
          }

          throw new GithubGraphqlError({
            code: 'RATE_LIMITED',
            message: 'GitHub rate limit reached.',
            status,
            rateLimit: lastRateLimit,
            cause: parsed,
          });
        }

        if (status === 401) {
          tokenIndex += 1;
          attempt += 1;
          continue;
        }

        if (status && status >= 500) {
          attempt += 1;
          if (attempt >= this.maxAttempts) {
            throw new GithubGraphqlError({
              code: 'HTTP_ERROR',
              message: `GitHub GraphQL request failed after retries (status ${status}).`,
              status,
              rateLimit: lastRateLimit,
              cause: parsed,
            });
          }
          await delay(backoffMs);
          backoffMs *= 2;
          continue;
        }

        throw new GithubGraphqlError({
          code: 'GRAPHQL_ERROR',
          message: 'GitHub GraphQL returned errors.',
          status,
          rateLimit: lastRateLimit,
          cause: parsed,
        });
      }
    }

    throw new GithubGraphqlError({
      code: 'MAX_ATTEMPTS',
      message: `GitHub GraphQL request exhausted attempts using tokens: ${tokenQueue
        .map((t) => t.type)
        .join(', ')}`,
      rateLimit: lastRateLimit,
    });
  }

  private parseRateLimit(error: OctokitErrorShape): GithubRateLimit {
    const headers = error.response?.headers;
    if (!headers) return {};

    const remainingRaw = headers['x-ratelimit-remaining'];
    const resetRaw = headers['x-ratelimit-reset'];
    const resourceRaw = headers['x-ratelimit-resource'];

    const remaining =
      typeof remainingRaw === 'string' || typeof remainingRaw === 'number'
        ? Number(remainingRaw)
        : undefined;
    const resetAt =
      (typeof resetRaw === 'string' || typeof resetRaw === 'number') &&
      String(resetRaw).length > 0
        ? Number(resetRaw) * 1000
        : undefined;

    return {
      remaining: Number.isNaN(remaining) ? undefined : remaining,
      resetAt: Number.isNaN(resetAt ?? NaN) ? undefined : resetAt,
      resource:
        typeof resourceRaw === 'string'
          ? resourceRaw
          : resourceRaw !== undefined
            ? String(resourceRaw)
            : undefined,
    };
  }

  private async waitForResetOrBackoff(
    rateLimit: GithubRateLimit,
    backoffMs: number,
  ) {
    if (rateLimit.resetAt && rateLimit.resetAt > Date.now()) {
      await delay(rateLimit.resetAt - Date.now());
      return;
    }

    await delay(backoffMs);
  }

  private extractRateLimit(payload: unknown): GithubRateLimit {
    if (typeof payload !== 'object' || payload === null) {
      return {};
    }
    const candidate = (payload as { rateLimit?: GithubRateLimit }).rateLimit;
    if (!candidate) return {};
    return {
      remaining: candidate.remaining,
      resetAt: candidate.resetAt
        ? typeof candidate.resetAt === 'string'
          ? Number(new Date(candidate.resetAt).getTime())
          : candidate.resetAt
        : undefined,
      resource: candidate.resource,
    };
  }

  private computeBaseUrl(): string {
    try {
      const url = new URL(this.endpoint);
      return url.origin;
    } catch {
      return this.endpoint.replace('/graphql', '');
    }
  }

  private buildContributionsQuery(): string {
    return `
      query($login: String!, $from: DateTime!, $to: DateTime!, $cursor: String) {
        rateLimit {
          remaining
          resetAt
          resource
        }
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            commitContributionsByRepository(first: 10, after: $cursor) {
              totalCount
            }
          }
        }
      }
    `;
  }
}
