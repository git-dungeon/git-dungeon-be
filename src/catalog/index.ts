import { readFile } from 'fs/promises';
import path from 'path';
import {
  assertCatalogData,
  type CatalogBuff,
  type CatalogData,
  type CatalogDropTable,
  type CatalogItem,
  type CatalogMonster,
} from './catalog.schema';

export interface CatalogFilePaths {
  items: string;
  buffs: string;
  monsters: string;
  drops: string;
}

export const DEFAULT_CATALOG_PATHS: CatalogFilePaths = {
  items: 'config/catalog/items.json',
  buffs: 'config/catalog/buffs.json',
  monsters: 'config/catalog/monsters.json',
  drops: 'config/catalog/drops.json',
};

const loadJson = async <T>(
  baseDir: string,
  relativePath: string,
): Promise<T> => {
  const absolutePath = path.join(baseDir, relativePath);
  const content = await readFile(absolutePath, 'utf8');
  return JSON.parse(content) as T;
};

const pickLatestTimestamp = (timestamps: string[]): string => {
  return timestamps.sort().at(-1) ?? new Date(0).toISOString();
};

export const loadCatalogData = async (
  baseDir = path.join(__dirname, '..', '..'),
  filePaths: CatalogFilePaths = DEFAULT_CATALOG_PATHS,
): Promise<CatalogData> => {
  const itemsFile = await loadJson<{
    version: number;
    updatedAt: string;
    items: CatalogItem[];
    assetsBaseUrl?: string | null;
    spriteMap?: Record<string, string> | null;
  }>(baseDir, filePaths.items);

  const buffsFile = await loadJson<{
    version: number;
    updatedAt: string;
    buffs: CatalogBuff[];
  }>(baseDir, filePaths.buffs);

  const monstersFile = await loadJson<{
    version: number;
    updatedAt: string;
    monsters: CatalogMonster[];
  }>(baseDir, filePaths.monsters);

  const dropsFile = await loadJson<{
    version: number;
    updatedAt: string;
    dropTables: CatalogDropTable[];
  }>(baseDir, filePaths.drops);

  const versions = [
    itemsFile.version,
    buffsFile.version,
    monstersFile.version,
    dropsFile.version,
  ];
  const updatedAt = pickLatestTimestamp([
    itemsFile.updatedAt,
    buffsFile.updatedAt,
    monstersFile.updatedAt,
    dropsFile.updatedAt,
  ]);

  const catalog: CatalogData = {
    version: Math.max(...versions),
    updatedAt,
    items: itemsFile.items,
    buffs: buffsFile.buffs,
    monsters: monstersFile.monsters,
    dropTables: dropsFile.dropTables,
    assetsBaseUrl: itemsFile.assetsBaseUrl ?? null,
    spriteMap: itemsFile.spriteMap ?? null,
  };

  return assertCatalogData(catalog);
};

export type {
  CatalogBuff,
  CatalogItem,
  CatalogMonster,
  CatalogDropTable,
} from './catalog.schema';
export {
  assertCatalogData,
  validateCatalogData,
  CATALOG_RARITIES,
} from './catalog.schema';
