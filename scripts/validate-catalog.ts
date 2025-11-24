import { loadCatalogData } from '../src/catalog';

const main = async (): Promise<void> => {
  try {
    const catalog = await loadCatalogData();

    console.log('Catalog validation succeeded', {
      version: catalog.version,
      updatedAt: catalog.updatedAt,
      items: catalog.items.length,
      buffs: catalog.buffs.length,
      monsters: catalog.monsters.length,
      dropTables: catalog.dropTables.length,
    });
  } catch (error) {
    console.error('Catalog validation failed', error);
    process.exit(1);
  }
};

void main();
