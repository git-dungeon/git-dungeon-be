import typia, { tags } from 'typia';

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  logPretty: boolean;
  dungeonInitialAp: number;
  corsAllowedOrigins: (string & tags.MinLength<1>)[];
  corsAllowCredentials: boolean;
  publicBaseUrl: string & tags.MinLength<1>;
  databaseUrl: string & tags.MinLength<1>;
  databaseShadowUrl: string & tags.MinLength<1>;
  databaseLogQueries: boolean;
  databaseSkipConnection: boolean;
  authGithubClientId: string & tags.MinLength<1>;
  authGithubClientSecret: string & tags.MinLength<1>;
  authGithubRedirectUri: string & tags.MinLength<1>;
  authGithubScope: string & tags.MinLength<1>;
  githubSyncPat: string;
  githubSyncPats: string[];
  githubSyncEndpoint: string & tags.MinLength<1>;
  githubSyncUserAgent: string & tags.MinLength<1>;
  githubSyncRateLimitFallbackRemaining: number;
  githubSyncCron: string & tags.MinLength<1>;
  githubSyncBatchSize: number;
  githubSyncManualCooldownMs: number;
  redisUrl: string & tags.MinLength<1>;
  // deprecated: use queue* for retry config
  githubTokenLockTtlMs: number;
  githubTokenRateLimitCacheMs: number;
  githubTokenCooldownMs: number;
  redisSkipConnection: boolean;
  dungeonBatchCron: string;
  dungeonBatchMaxUsersPerTick: number;
  dungeonBatchMaxActionsPerUser: number;
  dungeonBatchMinAp: number;
  dungeonBatchInactiveDays: number;
  dungeonBatchLockTtlMs: number;
  dungeonBatchLockBackoffMs: number;
  dungeonBatchLockMaxRetry: number;
  queueRetryMax: number;
  queueRetryBackoffBaseMs: number;
  queueRetryTtlMs: number;
  queueDlqTtlDays: number;
  queueRetryConcurrency: number;
  alertWebhookUrl: string;
  alertFailureThreshold: number;
}

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (typeof value === 'undefined') {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const parseNumber = (value: string | undefined, defaultValue: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const parseStringArray = (
  value: string | undefined,
  defaults: string[],
): string[] => {
  if (typeof value === 'undefined' || value.trim().length === 0) {
    return defaults;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : defaults;
};

export const loadEnvironment = (): Environment => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
  const databaseUrl =
    process.env.DATABASE_URL ??
    (nodeEnv === 'test'
      ? 'postgresql://postgres:postgres@localhost:5432/git_dungeon_test'
      : '');
  const databaseShadowUrl = process.env.DATABASE_SHADOW_URL ?? databaseUrl;
  const defaultGithubRedirect =
    nodeEnv === 'production'
      ? ''
      : 'http://localhost:3000/api/auth/callback/github';
  const defaultCorsOrigins =
    nodeEnv === 'production'
      ? ['https://app.gitdungeon.com']
      : nodeEnv === 'test'
        ? ['http://localhost:4173']
        : [
            'http://localhost:4173',
            'http://localhost:5173',
            'https://staging.gitdungeon.com',
            'https://app.gitdungeon.com',
          ];

  const raw = {
    nodeEnv,
    port: parseNumber(process.env.PORT, 3000),
    logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
    logPretty: parseBoolean(process.env.LOG_PRETTY, nodeEnv !== 'production'),
    corsAllowedOrigins: parseStringArray(
      process.env.CORS_ALLOWED_ORIGINS,
      defaultCorsOrigins,
    ),
    corsAllowCredentials: parseBoolean(
      process.env.CORS_ALLOW_CREDENTIALS,
      true,
    ),
    dungeonInitialAp: parseNumber(process.env.DUNGEON_INITIAL_AP, 10),
    publicBaseUrl:
      process.env.PUBLIC_BASE_URL ??
      (nodeEnv === 'production' ? '' : 'http://localhost:3000'),
    databaseUrl,
    databaseShadowUrl,
    databaseLogQueries: parseBoolean(
      process.env.DATABASE_LOG_QUERIES,
      nodeEnv !== 'production',
    ),
    databaseSkipConnection: parseBoolean(
      process.env.DATABASE_SKIP_CONNECTION,
      nodeEnv === 'test',
    ),
    authGithubClientId:
      process.env.AUTH_GITHUB_CLIENT_ID ??
      (nodeEnv === 'test' ? 'test-github-client-id' : ''),
    authGithubClientSecret:
      process.env.AUTH_GITHUB_CLIENT_SECRET ??
      (nodeEnv === 'test' ? 'test-github-client-secret' : ''),
    authGithubRedirectUri:
      process.env.AUTH_GITHUB_REDIRECT_URI ?? defaultGithubRedirect,
    authGithubScope: process.env.AUTH_GITHUB_SCOPE ?? 'read:user,user:email',
    githubSyncPat: process.env.GITHUB_SYNC_PAT ?? '',
    githubSyncPats: (() => {
      const singlePat = process.env.GITHUB_SYNC_PAT ?? '';
      return parseStringArray(
        process.env.GITHUB_SYNC_PATS,
        singlePat.trim().length ? [singlePat.trim()] : [],
      );
    })(),
    githubSyncEndpoint:
      process.env.GITHUB_SYNC_ENDPOINT ?? 'https://api.github.com/graphql',
    githubSyncUserAgent:
      process.env.GITHUB_SYNC_USER_AGENT ?? 'git-dungeon-backend',
    githubSyncRateLimitFallbackRemaining: parseNumber(
      process.env.GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING,
      100,
    ),
    githubSyncCron: process.env.GITHUB_SYNC_CRON ?? '0 0 0 * * *', // every day at 00:00:00
    githubSyncBatchSize: parseNumber(process.env.GITHUB_SYNC_BATCH_SIZE, 50),
    githubSyncManualCooldownMs: parseNumber(
      process.env.GITHUB_SYNC_MANUAL_COOLDOWN_MS,
      6 * 60 * 60 * 1000, // 6 hours
    ),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    githubTokenLockTtlMs: parseNumber(
      process.env.GITHUB_TOKEN_LOCK_TTL_MS,
      30_000,
    ),
    githubTokenRateLimitCacheMs: parseNumber(
      process.env.GITHUB_TOKEN_RATE_LIMIT_CACHE_MS,
      5 * 60 * 1000,
    ),
    githubTokenCooldownMs: parseNumber(
      process.env.GITHUB_TOKEN_COOLDOWN_MS,
      15 * 60 * 1000,
    ),
    redisSkipConnection: parseBoolean(
      process.env.REDIS_SKIP_CONNECTION,
      nodeEnv === 'test',
    ),
    dungeonBatchCron: process.env.DUNGEON_BATCH_CRON ?? '0 */5 * * * *', // every 5 minutes
    dungeonBatchMaxUsersPerTick: parseNumber(
      process.env.DUNGEON_BATCH_MAX_USERS_PER_TICK,
      200,
    ),
    dungeonBatchMaxActionsPerUser: parseNumber(
      process.env.DUNGEON_BATCH_MAX_ACTIONS_PER_USER,
      5,
    ),
    dungeonBatchMinAp: parseNumber(process.env.DUNGEON_BATCH_MIN_AP, 1),
    dungeonBatchInactiveDays: parseNumber(
      process.env.DUNGEON_BATCH_INACTIVE_DAYS,
      30,
    ),
    dungeonBatchLockTtlMs: parseNumber(
      process.env.DUNGEON_BATCH_LOCK_TTL_MS,
      60_000,
    ),
    dungeonBatchLockBackoffMs: parseNumber(
      process.env.DUNGEON_BATCH_LOCK_BACKOFF_MS,
      200,
    ),
    dungeonBatchLockMaxRetry: parseNumber(
      process.env.DUNGEON_BATCH_LOCK_MAX_RETRY,
      3,
    ),
    queueRetryMax: parseNumber(process.env.QUEUE_RETRY_MAX, 3),
    queueRetryBackoffBaseMs: parseNumber(
      process.env.QUEUE_RETRY_BACKOFF_BASE_MS,
      1_500,
    ),
    queueRetryTtlMs: parseNumber(
      process.env.QUEUE_RETRY_TTL_MS,
      2 * 60 * 60 * 1000,
    ),
    queueRetryConcurrency: parseNumber(process.env.QUEUE_RETRY_CONCURRENCY, 5),
    queueDlqTtlDays: parseNumber(process.env.QUEUE_DLQ_TTL_DAYS, 7),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? '',
    alertFailureThreshold: parseNumber(process.env.ALERT_FAILURE_THRESHOLD, 3),
  };

  return assertEnvironment(raw);
};

const assertEnvironment = (value: unknown): Environment => {
  try {
    return typia.assert<Environment>(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('no transform has been configured')) {
      return value as Environment;
    }
    throw error;
  }
};
