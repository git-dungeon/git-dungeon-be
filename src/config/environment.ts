import typia, { tags } from 'typia';

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  logPretty: boolean;
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
  githubSyncEndpoint: string & tags.MinLength<1>;
  githubSyncUserAgent: string & tags.MinLength<1>;
  githubSyncRateLimitFallbackRemaining: number;
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
    githubSyncEndpoint:
      process.env.GITHUB_SYNC_ENDPOINT ?? 'https://api.github.com/graphql',
    githubSyncUserAgent:
      process.env.GITHUB_SYNC_USER_AGENT ?? 'git-dungeon-backend',
    githubSyncRateLimitFallbackRemaining: parseNumber(
      process.env.GITHUB_SYNC_RATE_LIMIT_FALLBACK_REMAINING,
      100,
    ),
  };

  return typia.assert<Environment>(raw);
};
