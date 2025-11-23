import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
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

export type CatalogTranslations = Record<string, string>;

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

export const loadTranslations = async (
  locale: string,
  baseDir = path.join(__dirname, '..', '..'),
): Promise<CatalogTranslations> => {
  const translationsPath = path.join(
    baseDir,
    'config/catalog/i18n',
    `${locale}.json`,
  );
  try {
    const content = await readFile(translationsPath, 'utf8');
    return JSON.parse(content) as CatalogTranslations;
  } catch {
    return {};
  }
};

const applyTranslations = <
  T extends {
    name: string;
    description?: string | null;
    nameKey?: string;
    descriptionKey?: string | null;
  },
>(
  items: T[],
  translations: CatalogTranslations,
): T[] =>
  items.map((item) => {
    const translatedName =
      (item.nameKey && translations[item.nameKey]) ?? item.name;
    const translatedDesc =
      (item.descriptionKey && translations[item.descriptionKey]) ??
      item.description ??
      null;

    return {
      ...item,
      name: translatedName,
      description: translatedDesc,
    };
  });

export const loadCatalogData = async (
  baseDir = path.join(__dirname, '..', '..'),
  filePaths: CatalogFilePaths = DEFAULT_CATALOG_PATHS,
  options?: { locale?: string; includeStrings?: boolean },
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

  const validated = assertCatalogData(catalog);

  if (options?.includeStrings) {
    const translations = await loadTranslations(
      options.locale ?? 'en',
      baseDir,
    );
    return {
      ...validated,
      items: applyTranslations(validated.items, translations),
      buffs: applyTranslations(validated.buffs, translations),
      monsters: applyTranslations(validated.monsters, translations),
    };
  }

  return validated;
};

export const computeCatalogHash = (catalog: CatalogData): string => {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(catalog));
  return hash.digest('hex');
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
