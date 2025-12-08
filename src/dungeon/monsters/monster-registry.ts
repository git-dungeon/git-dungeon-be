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
      if (registry[monster.id]) {
        throw new Error(`Duplicate monster id detected: ${monster.id}`);
      }
      registry[monster.id] = monster;
    });
    return new MonsterRegistry(registry);
  }

  getMeta(id: string): CatalogMonster {
    const meta = this.monsters[id];
    if (!meta) {
      throw new Error(`Unknown monster id: ${id}`);
    }
    return meta;
  }

  getScaledMonster(
    id: string,
    floor: number,
    options?: MonsterScalingOptions,
  ): ScaledMonster {
    const meta = this.getMeta(id);
    return {
      meta,
      stats: getScaledStats(meta, floor, options),
    };
  }

  list(): CatalogMonster[] {
    return Object.values(this.monsters);
  }
}
