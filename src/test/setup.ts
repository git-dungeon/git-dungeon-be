import { afterAll, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('OPENAPI_VALIDATION_MODE', 'off');
vi.stubEnv(
  'DATABASE_URL',
  'postgresql://postgres:postgres@localhost:5432/git_dungeon_test',
);
vi.stubEnv(
  'DATABASE_SHADOW_URL',
  'postgresql://postgres:postgres@localhost:5432/git_dungeon_shadow',
);
vi.stubEnv('DATABASE_SKIP_CONNECTION', 'true');
vi.stubEnv('REDIS_SKIP_CONNECTION', 'true');

afterAll(() => {
  vi.unstubAllEnvs();
});
