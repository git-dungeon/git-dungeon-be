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
  };

  return typia.assert<Environment>(raw);
};
