import { afterAll, beforeAll, vi } from 'vitest';

beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv(
    'DATABASE_URL',
    process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/git_dungeon_test',
  );
  vi.stubEnv(
    'DATABASE_SHADOW_URL',
    process.env.DATABASE_SHADOW_URL ??
      'postgresql://postgres:postgres@localhost:5432/git_dungeon_shadow',
  );
  vi.stubEnv(
    'DATABASE_SKIP_CONNECTION',
    process.env.DATABASE_SKIP_CONNECTION ?? 'true',
  );
  vi.stubEnv('REDIS_SKIP_CONNECTION', 'true');
});

afterAll(() => {
  vi.unstubAllEnvs();
});
