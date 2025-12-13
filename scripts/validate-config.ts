import { loadCatalogData, loadTranslations } from '../src/catalog';
import { loadEventConfigStrict } from '../src/dungeon/events/config/event-config.loader';

const assertNonEmptyTranslations = (
  locale: string,
  data: Record<string, unknown>,
): void => {
  const count = Object.keys(data).length;
  if (count === 0) {
    throw new Error(`I18n validation failed: locale="${locale}" has 0 keys`);
  }
};

const main = async (): Promise<void> => {
  try {
    const catalog = await (async () => {
      try {
        return await loadCatalogData();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Catalog validation failed: ${message}`);
      }
    })();

    const eventConfig = (() => {
      try {
        return loadEventConfigStrict();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Event config validation failed: ${message}`);
      }
    })();

    const en = await (async () => {
      try {
        const data = await loadTranslations('en');
        assertNonEmptyTranslations('en', data);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`I18n validation failed (en): ${message}`);
      }
    })();

    const ko = await (async () => {
      try {
        const data = await loadTranslations('ko');
        assertNonEmptyTranslations('ko', data);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`I18n validation failed (ko): ${message}`);
      }
    })();

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
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Config validation failed: ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
};

void main();
