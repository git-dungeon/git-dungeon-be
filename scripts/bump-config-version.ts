import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import {
  computeCatalogHash,
  type JsonValue,
} from '../src/catalog/catalog-hash.util';

type WatchedFile = {
  kind: string;
  path: string;
  bumpVersion?: boolean;
};

interface HashStore {
  [key: string]: string;
}

const WATCHED_FILES: WatchedFile[] = [
  { kind: 'items', path: 'config/catalog/items.json', bumpVersion: true },
  { kind: 'buffs', path: 'config/catalog/buffs.json', bumpVersion: true },
  { kind: 'monsters', path: 'config/catalog/monsters.json', bumpVersion: true },
  { kind: 'drops', path: 'config/catalog/drops.json', bumpVersion: true },
  {
    kind: 'enhancement',
    path: 'config/catalog/enhancement.json',
    bumpVersion: true,
  },
  {
    kind: 'dismantle',
    path: 'config/catalog/dismantle.json',
    bumpVersion: true,
  },
  { kind: 'event-config', path: 'config/dungeon/event-config.json' },
  { kind: 'i18n-en', path: 'config/catalog/i18n/en.json' },
  { kind: 'i18n-ko', path: 'config/catalog/i18n/ko.json' },
];

const HASH_STORE = 'config/config.hashes.json';

const sanitizeForHash = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const clone = { ...data };
  delete clone.version;
  delete clone.updatedAt;
  return clone;
};

const loadJson = async <T>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
};

const writeJson = async (filePath: string, data: unknown): Promise<void> => {
  const content = JSON.stringify(data, null, 2) + '\n';
  await writeFile(filePath, content, 'utf8');
};

const bumpConfigs = async (): Promise<void> => {
  const baseDir = path.resolve(__dirname, '..');
  const hashStorePath = path.join(baseDir, HASH_STORE);

  let storedHashes: HashStore = {};
  try {
    storedHashes = await loadJson<HashStore>(hashStorePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      storedHashes = {};
    } else if (
      (err as NodeJS.ErrnoException).code === 'EACCES' ||
      (err as NodeJS.ErrnoException).code === 'EPERM' ||
      err instanceof SyntaxError
    ) {
      console.error(`[config] Failed to read hash store ${hashStorePath}`, err);
      process.exit(1);
    } else {
      throw err;
    }
  }

  const now = new Date().toISOString();
  const nextHashes: HashStore = {};

  for (const file of WATCHED_FILES) {
    const absolutePath = path.join(baseDir, file.path);
    const data = await loadJson<Record<string, unknown>>(absolutePath);
    const sanitized = sanitizeForHash(data);
    const hash = computeCatalogHash(sanitized as unknown as JsonValue);
    const prevHash = storedHashes[file.path];

    if (hash !== prevHash) {
      if (file.bumpVersion) {
        const currentVersion =
          typeof data.version === 'number' ? data.version : 0;
        const nextVersion = currentVersion + 1;
        const updated = {
          ...data,
          version: nextVersion,
          updatedAt: now,
        };
        await writeJson(absolutePath, updated);
        console.log(
          `[config] ${file.kind} changed -> version ${currentVersion} -> ${nextVersion}, updatedAt ${now}`,
        );
      } else {
        console.log(`[config] ${file.kind} changed (hash updated)`);
      }
    } else {
      const versionInfo = file.bumpVersion
        ? ` (version ${String(data.version)})`
        : '';
      console.log(`[config] ${file.kind} unchanged${versionInfo}`);
    }

    nextHashes[file.path] = hash;
  }

  await writeJson(hashStorePath, nextHashes);
};

void bumpConfigs().catch((error) => {
  console.error('Failed to bump config version', error);
  process.exit(1);
});
