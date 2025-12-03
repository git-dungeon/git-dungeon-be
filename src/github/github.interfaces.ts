import { ApSyncTokenType } from '@prisma/client';

export type GithubTokenType = 'oauth' | 'pat';

export interface GithubTokenCandidate {
  token: string;
  type: GithubTokenType;
}

export interface GithubRateLimit {
  remaining?: number;
  resetAt?: number;
  resource?: string;
}

export interface GithubGraphqlClientOptions {
  endpoint: string;
  userAgent: string;
  patToken?: string | null;
  patTokens?: string[];
  rateLimitThreshold?: number;
  baseBackoffMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  octokitFactory?: (token: string) => GithubOctokitInstance;
}

export interface GithubGraphqlErrorPayload {
  code:
    | 'RATE_LIMITED'
    | 'UNAUTHORIZED'
    | 'HTTP_ERROR'
    | 'GRAPHQL_ERROR'
    | 'MAX_ATTEMPTS';
  message: string;
  status?: number;
  rateLimit?: GithubRateLimit;
}

export interface GithubGraphqlErrorOptions extends GithubGraphqlErrorPayload {
  cause?: unknown;
}

export class GithubGraphqlError
  extends Error
  implements GithubGraphqlErrorPayload
{
  code: GithubGraphqlErrorPayload['code'];
  status?: number;
  rateLimit?: GithubRateLimit;

  constructor(options: GithubGraphqlErrorOptions) {
    super(options.message);
    this.name = 'GithubGraphqlError';
    this.code = options.code;
    this.status = options.status;
    this.rateLimit = options.rateLimit;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export interface FetchContributionsVariables {
  login: string;
  from: string;
  to: string;
  cursor?: string | null;
}

export interface FetchContributionsResult<TData = unknown> {
  data: TData;
  rateLimit: GithubRateLimit;
  tokenType: GithubTokenType;
  attempts?: number;
  tokensTried?: GithubTokenType[];
  backoffMs?: number;
}

export interface GithubOctokitInstance {
  graphql: <T = any>(
    query: string,
    variables: Record<string, any>,
  ) => Promise<T>;
}

export interface GithubSyncResponse {
  apDelta: number;
  contributions: number;
  windowStart: string;
  windowEnd: string;
  tokenType: ApSyncTokenType;
  rateLimitRemaining?: number;
  logId: string;
  meta?: {
    rateLimit: {
      remaining: number | null;
      resetAt: number | null;
      resource: string | null;
    } | null;
    totals?: {
      contributions: number;
    };
    tokensTried?: GithubTokenType[];
    attempts?: number;
    backoffMs?: number | null;
  } | null;
}
