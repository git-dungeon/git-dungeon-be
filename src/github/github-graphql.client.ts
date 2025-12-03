import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
  GithubTokenType,
} from './github.interfaces';
import { GithubTokenGuard } from './github-token.guard';

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
  private readonly logger = new Logger(GithubGraphqlClient.name);
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly patTokens: string[];
  private readonly rateLimitThreshold: number;
  private readonly baseBackoffMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly octokitFactory?: (token: string) => GithubOctokitInstance;

  constructor(
    @Inject(GITHUB_GRAPHQL_OPTIONS)
    options: GithubGraphqlClientOptions,
    @Optional() private readonly tokenGuard?: GithubTokenGuard,
  ) {
    this.endpoint = options.endpoint;
    this.userAgent = options.userAgent;
    const patPool = [options.patToken ?? null, ...(options.patTokens ?? [])]
      .filter((t): t is string => !!t && t.trim().length > 0)
      .map((t) => t.trim());
    this.patTokens = Array.from(new Set(patPool));
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
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.TEST_FORCE_GITHUB_RATE_LIMIT === 'true'
    ) {
      throw new GithubGraphqlError({
        code: 'RATE_LIMITED',
        message: 'Forced rate limit for testing',
        rateLimit: {
          remaining: 0,
          resetAt: Date.now() + 5_000,
          resource: 'core',
        },
      });
    }

    const tokenQueue: GithubTokenCandidate[] = [];
    if (accessToken?.trim()) {
      tokenQueue.push({ token: accessToken.trim(), type: 'oauth' });
    }
    this.patTokens.forEach((pat) => {
      tokenQueue.push({ token: pat, type: 'pat' });
    });

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

  async fetchViewerLogin(
    accessToken: string | null | undefined,
  ): Promise<string | null> {
    const token = accessToken?.trim();
    if (!token) return null;

    const client = this.createOctokit(token);
    try {
      const result: unknown = await client.graphql(this.buildViewerQuery(), {});
      if (typeof result !== 'object' || result === null) {
        return null;
      }

      const viewer = (result as { viewer?: unknown }).viewer;
      if (typeof viewer !== 'object' || viewer === null) {
        return null;
      }

      const login = (viewer as { login?: unknown }).login;
      return typeof login === 'string' ? login : null;
    } catch {
      return null;
    }
  }

  private async executeWithRetry<TData>(
    tokenQueue: GithubTokenCandidate[],
    variables: FetchContributionsVariables,
  ): Promise<FetchContributionsResult<TData>> {
    let attempt = 0;
    let tokenIndex = 0;
    let backoffMs = this.baseBackoffMs;
    let totalBackoffMs = 0;
    let lastRateLimit: GithubRateLimit | undefined;
    const tokensTried: GithubTokenType[] = [];
    const tokenCount = tokenQueue.length;
    const skippedTokens = new Set<number>();

    while (attempt < this.maxAttempts && tokenCount > 0) {
      const candidateIndex = tokenIndex % tokenCount;
      const candidate = tokenQueue[candidateIndex];

      const skipDecision = await this.tokenGuard?.shouldSkipToken(
        candidate,
        this.rateLimitThreshold,
      );
      if (skipDecision?.skip) {
        skippedTokens.add(candidateIndex);
        this.logger.warn({
          message: 'Skipping GitHub token due to cooldown or cached rate limit',
          tokenType: candidate.type,
          retryAt: skipDecision.retryAt ?? null,
          remaining: skipDecision.remaining ?? null,
          reason: skipDecision.reason,
        });

        if (skippedTokens.size >= tokenCount) {
          throw new GithubGraphqlError({
            code: 'RATE_LIMITED',
            message:
              'No available GitHub tokens (cooldown or rate limited cache).',
            rateLimit: lastRateLimit ?? {
              remaining: skipDecision.remaining ?? undefined,
              resetAt: skipDecision.retryAt,
              resource: skipDecision.resource ?? undefined,
            },
          });
        }

        tokenIndex = (candidateIndex + 1) % tokenCount;
        continue;
      }

      const lockAcquired = await this.tokenGuard?.acquireLock(candidate);
      if (lockAcquired === false) {
        skippedTokens.add(candidateIndex);
        this.logger.warn({
          message: 'GitHub token lock not acquired; rotating token',
          tokenType: candidate.type,
        });

        if (skippedTokens.size >= tokenCount) {
          throw new GithubGraphqlError({
            code: 'RATE_LIMITED',
            message: 'No available GitHub tokens (lock contention).',
            rateLimit: lastRateLimit,
          });
        }

        tokenIndex = (candidateIndex + 1) % tokenCount;
        continue;
      }

      const hasLock = lockAcquired === true;
      tokensTried.push(candidate.type);
      skippedTokens.clear();
      try {
        const client = this.createOctokit(candidate.token);
        const result = (await client.graphql(this.buildContributionsQuery(), {
          ...variables,
        })) as unknown;
        const rateLimit = this.extractRateLimit(result);

        await this.tokenGuard?.recordRateLimit(candidate, rateLimit);

        if (this.shouldWarnRateLimit(rateLimit)) {
          this.logger.warn({
            message: 'GitHub GraphQL rate limit is low',
            remaining: rateLimit.remaining ?? null,
            resetAt: rateLimit.resetAt ?? null,
            tokenType: candidate.type,
            attempts: attempt + 1,
            tokensTried,
            threshold: this.rateLimitThreshold,
          });
        }

        return {
          data: result as TData,
          rateLimit,
          tokenType: candidate.type,
          attempts: attempt + 1,
          tokensTried,
          backoffMs: totalBackoffMs,
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
          await this.tokenGuard?.recordRateLimit(candidate, lastRateLimit);
          const cooldownMs =
            lastRateLimit?.resetAt && lastRateLimit.resetAt > Date.now()
              ? lastRateLimit.resetAt - Date.now()
              : undefined;
          await this.tokenGuard?.markCooldown(
            candidate,
            'RATE_LIMITED',
            cooldownMs,
          );

          if (tokenQueue.length > 1) {
            this.logger.warn({
              message: 'GitHub GraphQL rate limited; rotating token',
              remaining: lastRateLimit?.remaining ?? null,
              resetAt: lastRateLimit?.resetAt ?? null,
              tokenType: candidate.type,
              nextTokenType:
                tokenQueue[(tokenIndex + 1) % tokenQueue.length]?.type,
              attempt: attempt + 1,
            });
            tokenIndex = (tokenIndex + 1) % tokenQueue.length;
            attempt += 1;
            const waited = await this.waitForResetOrBackoff(
              lastRateLimit,
              backoffMs,
            );
            totalBackoffMs += waited;
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
          await this.tokenGuard?.markCooldown(candidate, 'UNAUTHORIZED');
          tokenIndex = (tokenIndex + 1) % tokenQueue.length;
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
          totalBackoffMs += backoffMs;
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
      } finally {
        if (hasLock) {
          await this.tokenGuard?.releaseLock(candidate);
        }
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
  ): Promise<number> {
    const now = Date.now();
    if (rateLimit.resetAt && rateLimit.resetAt > Date.now()) {
      const waitMs = rateLimit.resetAt - now;
      await delay(waitMs);
      return waitMs;
    }

    await delay(backoffMs);
    return backoffMs;
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

  private shouldWarnRateLimit(rateLimit: GithubRateLimit): boolean {
    if (typeof rateLimit.remaining !== 'number') return false;
    return rateLimit.remaining <= this.rateLimitThreshold;
  }

  private buildContributionsQuery(): string {
    return `
      query($login: String!, $from: DateTime!, $to: DateTime!, $cursor: String) {
        rateLimit {
          remaining
          resetAt
        }
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
            restrictedContributionsCount
            pullRequestContributions(first: 1, after: $cursor) {
              totalCount
            }
            pullRequestReviewContributions(first: 1, after: $cursor) {
              totalCount
            }
            issueContributions(first: 1, after: $cursor) {
              totalCount
            }
          }
        }
      }
    `;
  }

  private buildViewerQuery(): string {
    return `
      query {
        viewer {
          login
        }
      }
    `;
  }
}
