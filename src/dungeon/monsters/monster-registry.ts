import type { CatalogMonster } from '../../catalog';
import {
  getScaledStats,
  type MonsterScalingOptions,
  type ScaledMonsterStats,
} from './monster-scaling';

export type ScaledMonster = {
  meta: CatalogMonster;
  stats: ScaledMonsterStats;
};

export class MonsterRegistry {
  constructor(private readonly monsters: Record<string, CatalogMonster>) {}

  static from(monsters: CatalogMonster[]): MonsterRegistry {
    const registry: Record<string, CatalogMonster> = {};
    monsters.forEach((monster) => {
      if (registry[monster.code]) {
        throw new Error(`Duplicate monster code detected: ${monster.code}`);
      }
      registry[monster.code] = monster;
    });
    return new MonsterRegistry(registry);
  }

  getMeta(code: string): CatalogMonster {
    const meta = this.monsters[code];
    if (!meta) {
      throw new Error(`Unknown monster code: ${code}`);
    }
    return meta;
  }

  getScaledMonster(
    code: string,
    floor: number,
    options?: MonsterScalingOptions,
  ): ScaledMonster {
    const meta = this.getMeta(code);
    return {
      meta,
      stats: getScaledStats(meta, floor, options),
    };
  }

  list(): CatalogMonster[] {
    return Object.values(this.monsters);
  }
}
