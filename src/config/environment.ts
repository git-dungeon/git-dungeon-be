import typia, { tags } from 'typia';

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  logPretty: boolean;
  databaseUrl: string & tags.MinLength<1>;
  databaseShadowUrl: string & tags.MinLength<1>;
  databaseLogQueries: boolean;
  databaseSkipConnection: boolean;
  authGithubClientId: string & tags.MinLength<1>;
  authGithubClientSecret: string & tags.MinLength<1>;
  authGithubRedirectUri: string & tags.MinLength<1>;
  authGithubScope: string & tags.MinLength<1>;
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

export const loadEnvironment = (): Environment => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
  const databaseUrl =
    process.env.DATABASE_URL ??
    (nodeEnv === 'test'
      ? 'postgresql://postgres:postgres@localhost:5432/git_dungeon_test'
      : '');
  const databaseShadowUrl = process.env.DATABASE_SHADOW_URL ?? databaseUrl;
  const defaultGithubRedirect =
    nodeEnv === 'test' ? 'http://localhost:4173/auth/github/callback' : '';

  const raw = {
    nodeEnv,
    port: parseNumber(process.env.PORT, 3000),
    logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
    logPretty: parseBoolean(process.env.LOG_PRETTY, nodeEnv !== 'production'),
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
  };

  return typia.assert<Environment>(raw);
};
