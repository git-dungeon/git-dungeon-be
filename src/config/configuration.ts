import { loadEnvironment } from './environment.js';

const configuration = () => {
  const env = loadEnvironment();

  return {
    app: {
      env: env.nodeEnv,
      port: env.port,
    },
    logger: {
      level: env.logLevel,
      pretty: env.logPretty,
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
          const scopes = env.authGithubScope
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

          return scopes.length > 0 ? scopes : ['read:user', 'user:email'];
        })(),
      },
    },
  };
};

export default configuration;
