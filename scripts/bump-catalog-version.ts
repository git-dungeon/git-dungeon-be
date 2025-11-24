import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import {
  computeCatalogHash,
  type JsonValue,
} from '../src/catalog/catalog-hash.util';

type CatalogFileKind = 'items' | 'buffs' | 'monsters' | 'drops';

interface CatalogHashes {
  [key: string]: string;
}

const CATALOG_FILES: Record<CatalogFileKind, string> = {
  items: 'config/catalog/items.json',
  buffs: 'config/catalog/buffs.json',
  monsters: 'config/catalog/monsters.json',
  drops: 'config/catalog/drops.json',
};

const HASH_STORE = 'config/catalog/catalog.hashes.json';

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

const bumpCatalog = async (): Promise<void> => {
  const baseDir = path.resolve(__dirname, '..');
  const hashStorePath = path.join(baseDir, HASH_STORE);

  let storedHashes: CatalogHashes = {};
  try {
    storedHashes = await loadJson<CatalogHashes>(hashStorePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      storedHashes = {};
    } else if (
      (err as NodeJS.ErrnoException).code === 'EACCES' ||
      (err as NodeJS.ErrnoException).code === 'EPERM' ||
      err instanceof SyntaxError
    ) {
      console.error(
        `[catalog] Failed to read hash store ${hashStorePath}`,
        err,
      );
      process.exit(1);
    } else {
      throw err;
    }
  }

  const now = new Date().toISOString();
  const nextHashes: CatalogHashes = {};

  for (const [kind, relativePath] of Object.entries(CATALOG_FILES)) {
    const absolutePath = path.join(baseDir, relativePath);
    const data = await loadJson<Record<string, unknown>>(absolutePath);
    const sanitized = sanitizeForHash(data);
    const hash = computeCatalogHash(sanitized as unknown as JsonValue);
    const prevHash = storedHashes[relativePath];

    if (hash !== prevHash) {
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
        `[catalog] ${kind} changed -> version ${currentVersion} -> ${nextVersion}, updatedAt ${now}`,
      );
    } else {
      console.log(
        `[catalog] ${kind} unchanged (version ${String(data.version)})`,
      );
    }

    nextHashes[relativePath] = hash;
  }

  await writeJson(hashStorePath, nextHashes);
};

void bumpCatalog().catch((error) => {
  console.error('Failed to bump catalog version', error);
  process.exit(1);
});
