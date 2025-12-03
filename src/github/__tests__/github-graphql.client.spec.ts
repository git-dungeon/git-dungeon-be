import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GithubGraphqlClient } from '../github-graphql.client';
import {
  GithubGraphqlClientOptions,
  GithubTokenCandidate,
  GithubOctokitInstance,
} from '../github.interfaces';
import { GithubTokenGuard } from '../github-token.guard';

const createClient = (
  factory: (token: string) => GithubOctokitInstance,
  tokenGuard?: GithubTokenGuard,
) =>
  new GithubGraphqlClient(
    {
      endpoint: 'https://api.github.com/graphql',
      userAgent: 'test-agent',
      patToken: 'pat-token',
      octokitFactory: factory,
      fetchImpl: vi.fn(), // unused with mocked factory
    } as GithubGraphqlClientOptions,
    tokenGuard,
  );

describe('GithubGraphqlClient (Octokit)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('OAuth 토큰을 우선 사용하고 cursor를 전달한다', async () => {
    const graphqlMock = vi.fn().mockResolvedValue({
      data: { ok: true },
      rateLimit: { remaining: 500 },
    });
    const factory = vi.fn((_token: string) => ({ graphql: graphqlMock }));

    const client = createClient(factory);
    const result = await client.fetchContributions('oauth-token', {
      login: 'octocat',
      from: '2025-11-01T00:00:00Z',
      to: '2025-11-02T00:00:00Z',
      cursor: 'abc',
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('oauth-token');
    expect(graphqlMock).toHaveBeenCalledWith(expect.any(String), {
      login: 'octocat',
      from: '2025-11-01T00:00:00Z',
      to: '2025-11-02T00:00:00Z',
      cursor: 'abc',
    });
    expect(result.tokenType).toBe('oauth');
  });

  it('레이트 리밋 시 PAT로 교체해 성공한다', async () => {
    const rateLimitError = Object.assign(new Error('rate limit'), {
      status: 403,
    });
    const factory = vi.fn((token: string) => {
      if (token === 'oauth-token') {
        return { graphql: vi.fn().mockRejectedValue(rateLimitError) };
      }
      return {
        graphql: vi.fn().mockResolvedValue({
          data: { ok: true },
          rateLimit: { remaining: 200 },
        }),
      };
    });

    const client = createClient(factory);
    const result = await client.fetchContributions('oauth-token', {
      login: 'octocat',
      from: '2025-11-01T00:00:00Z',
      to: '2025-11-02T00:00:00Z',
    });

    expect(result.tokenType).toBe('pat');
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('5xx 오류 시 지수 백오프 후 재시도한다', async () => {
    vi.useFakeTimers();
    const serverError = Object.assign(new Error('server error'), {
      status: 502,
    });
    const okResponse = { data: { ok: true }, rateLimit: { remaining: 300 } };

    const graphqlMock = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce(okResponse);

    const factory = vi.fn((_token: string) => ({ graphql: graphqlMock }));
    const client = createClient(factory);

    const promise = client.fetchContributions('oauth-token', {
      login: 'octocat',
      from: '2025-11-01T00:00:00Z',
      to: '2025-11-02T00:00:00Z',
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.data).toEqual(okResponse);
    expect(graphqlMock).toHaveBeenCalledTimes(2);
  });

  it('레이트 리밋 캐시된 토큰을 건너뛰고 다음 토큰을 사용한다', async () => {
    const graphqlPat = vi.fn().mockResolvedValue({
      data: { ok: true },
      rateLimit: { remaining: 150 },
    });

    const factory = vi.fn((token: string) => {
      if (token === 'oauth-token') {
        return { graphql: vi.fn() };
      }
      return { graphql: graphqlPat };
    });

    const tokenGuard: Pick<
      GithubTokenGuard,
      | 'shouldSkipToken'
      | 'acquireLock'
      | 'releaseLock'
      | 'recordRateLimit'
      | 'markCooldown'
      | 'onModuleDestroy'
    > = {
      shouldSkipToken: vi
        .fn()
        .mockImplementation((candidate: GithubTokenCandidate) => {
          if (candidate.token === 'oauth-token') {
            return {
              skip: true,
              reason: 'RATE_LIMIT_CACHE',
              remaining: 0,
              retryAt: Date.now() + 1000,
            };
          }
          return { skip: false };
        }),
      acquireLock: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      recordRateLimit: vi.fn().mockResolvedValue(undefined),
      markCooldown: vi.fn().mockResolvedValue(undefined),
      onModuleDestroy: vi.fn().mockResolvedValue(undefined),
    };

    const client = createClient(
      factory,
      tokenGuard as unknown as GithubTokenGuard,
    );
    const result = await client.fetchContributions('oauth-token', {
      login: 'octocat',
      from: '2025-11-01T00:00:00Z',
      to: '2025-11-02T00:00:00Z',
    });

    expect(result.tokenType).toBe('pat');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('pat-token');
    expect(tokenGuard.shouldSkipToken).toHaveBeenCalled();
  });
});
