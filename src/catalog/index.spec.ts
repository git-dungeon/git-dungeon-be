import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCatalogData, type CatalogFilePaths } from './index';

vi.mock('typia', async () => {
  const { typiaModuleMock } = await import('../test-support/mocks/typia');
  return typiaModuleMock;
});

const writeJson = async (filePath: string, payload: unknown) => {
  await writeFile(filePath, JSON.stringify(payload));
};

describe('catalog load', () => {
  it('enhancement 설정을 포함해 로드한다', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'catalog-test-'));
    const filePaths: CatalogFilePaths = {
      items: 'items.json',
      buffs: 'buffs.json',
      monsters: 'monsters.json',
      drops: 'drops.json',
      enhancement: 'enhancement.json',
      dismantle: 'dismantle.json',
    };

    const enhancementConfig = {
      maxLevel: 10,
      successRates: { '1': 0.8 },
      goldCosts: { '1': 10 },
      materialCounts: { '1': 2 },
      materialsBySlot: {
        weapon: 'material-metal-scrap',
        armor: 'material-cloth-scrap',
        helmet: 'material-leather-scrap',
        ring: 'material-mithril-dust',
      },
    };

    try {
      await writeJson(join(baseDir, filePaths.items), {
        version: 1,
        updatedAt: '2026-02-01T00:00:00.000Z',
        items: [],
        assetsBaseUrl: null,
        spriteMap: null,
      });
      await writeJson(join(baseDir, filePaths.buffs), {
        version: 1,
        updatedAt: '2026-02-01T00:00:00.000Z',
        buffs: [],
      });
      await writeJson(join(baseDir, filePaths.monsters), {
        version: 2,
        updatedAt: '2026-02-02T00:00:00.000Z',
        monsters: [],
      });
      await writeJson(join(baseDir, filePaths.drops), {
        version: 1,
        updatedAt: '2026-02-01T00:00:00.000Z',
        dropTables: [],
      });
      await writeJson(join(baseDir, filePaths.enhancement), {
        version: 3,
        updatedAt: '2026-02-03T00:00:00.000Z',
        enhancement: enhancementConfig,
      });
      await writeJson(join(baseDir, filePaths.dismantle), {
        version: 1,
        updatedAt: '2026-02-01T00:00:00.000Z',
        dismantle: {
          baseMaterialQuantityByRarity: {
            common: 1,
            uncommon: 2,
            rare: 3,
            epic: 4,
            legendary: 5,
          },
          refundByEnhancementLevel: {
            '0': 0,
            '1': 0,
            '2': 1,
          },
        },
      });

      const catalog = await loadCatalogData(baseDir, filePaths);

      expect(catalog.version).toBe(3);
      expect(catalog.updatedAt).toBe('2026-02-03T00:00:00.000Z');
      expect(catalog.enhancement).toEqual(enhancementConfig);
      expect(catalog.dismantle.baseMaterialQuantityByRarity.rare).toBe(3);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
