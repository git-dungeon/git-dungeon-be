import { loadEnvironment } from './environment';

const configuration = () => {
  const env = loadEnvironment();

  return {
    app: {
      env: env.nodeEnv,
      port: env.port,
      publicBaseUrl: env.publicBaseUrl,
      cors: {
        allowedOrigins: env.corsAllowedOrigins,
        allowCredentials: env.corsAllowCredentials,
      },
    },
    logger: {
      level: env.logLevel,
      pretty: env.logPretty,
    },
    dungeon: {
      initialAp: env.dungeonInitialAp,
      batch: {
        cron: env.dungeonBatchCron,
        maxUsersPerTick: env.dungeonBatchMaxUsersPerTick,
        maxActionsPerUser: env.dungeonBatchMaxActionsPerUser,
        minAp: env.dungeonBatchMinAp,
        inactiveDays: env.dungeonBatchInactiveDays,
        lockTtlMs: env.dungeonBatchLockTtlMs,
        lockBackoffMs: env.dungeonBatchLockBackoffMs,
        lockMaxRetry: env.dungeonBatchLockMaxRetry,
      },
    },
    queue: {
      retryMax: env.queueRetryMax,
      retryBackoffBaseMs: env.queueRetryBackoffBaseMs,
      retryTtlMs: env.queueRetryTtlMs,
      dlqTtlDays: env.queueDlqTtlDays,
      alertWebhookUrl: env.alertWebhookUrl,
      alertFailureThreshold: env.alertFailureThreshold,
    },
    database: {
      url: env.databaseUrl,
      shadowUrl: env.databaseShadowUrl,
      logQueries: env.databaseLogQueries,
      skipConnection: env.databaseSkipConnection,
    },
    auth: {
      github: {
        clientId: env.authGithubClientId,
        clientSecret: env.authGithubClientSecret,
        redirectUri: env.authGithubRedirectUri,
        scope: (() => {
          const scopeSource = env.authGithubScope ?? '';
          const scopes = scopeSource
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

          return scopes.length > 0 ? scopes : ['read:user', 'user:email'];
        })(),
      },
    },
    github: {
      sync: {
        pat: env.githubSyncPat?.trim().length ? env.githubSyncPat.trim() : null,
        pats: env.githubSyncPats ?? [],
        endpoint: env.githubSyncEndpoint,
        userAgent: env.githubSyncUserAgent,
        rateLimitFallbackRemaining: env.githubSyncRateLimitFallbackRemaining,
        cron: env.githubSyncCron,
        batchSize: env.githubSyncBatchSize,
        manualCooldownMs: env.githubSyncManualCooldownMs,
        retryMax: env.queueRetryMax,
        retryBackoffBaseMs: env.queueRetryBackoffBaseMs,
        retryTtlMs: env.queueRetryTtlMs,
        retryConcurrency: env.queueRetryConcurrency,
      },
    },
    redis: {
      url: env.redisUrl,
      skipConnection: env.redisSkipConnection,
    },
  };
};

export default configuration;
