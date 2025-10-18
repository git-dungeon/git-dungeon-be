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
  };
};

export default configuration;
