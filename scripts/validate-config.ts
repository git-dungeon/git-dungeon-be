import { loadCatalogData, loadTranslations } from '../src/catalog';
import { loadEventConfig } from '../src/dungeon/events/config/event-config.loader';

const main = async (): Promise<void> => {
  try {
    const catalog = await loadCatalogData();
    const eventConfig = loadEventConfig();
    const en = await loadTranslations('en');
    const ko = await loadTranslations('ko');

    console.log('Catalog validation succeeded', {
      version: catalog.version,
      updatedAt: catalog.updatedAt,
      items: catalog.items.length,
      buffs: catalog.buffs.length,
      monsters: catalog.monsters.length,
      dropTables: catalog.dropTables.length,
    });

    console.log('Event config validation succeeded', {
      weights: eventConfig.weights,
      battle: {
        eliteRate: eventConfig.battle.eliteRate,
        critBase: eventConfig.battle.critBase,
        turnLimit: eventConfig.battle.turnLimit,
      },
    });

    console.log('I18n validation succeeded', {
      enKeys: Object.keys(en).length,
      koKeys: Object.keys(ko).length,
    });
  } catch (error) {
    console.error('Catalog validation failed', error);
    process.exit(1);
  }
};

void main();
