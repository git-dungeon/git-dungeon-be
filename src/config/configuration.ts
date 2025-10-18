const parsePort = (value: string | undefined): number => {
  const defaultPort = 3000;
  if (!value) {
    return defaultPort;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return defaultPort;
  }

  return parsed;
};

const configuration = () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parsePort(process.env.PORT),
  },
});

export default configuration;
