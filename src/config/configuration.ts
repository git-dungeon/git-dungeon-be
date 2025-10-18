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
  };
};

export default configuration;
