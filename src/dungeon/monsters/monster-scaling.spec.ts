import { describe, expect, it } from 'vitest';
import type { CatalogMonster } from '../../catalog';
import { MonsterRegistry } from './monster-registry';
import { getScaledStats } from './monster-scaling';

const baseMonster: CatalogMonster = {
  code: 'monster-test',
  nameKey: 'monster.test.name',
  descriptionKey: 'monster.test.desc',
  name: 'Test Monster',
  hp: 10,
  atk: 2,
  def: 1,
  spriteId: 'sprite/monster-test',
  dropTableId: 'drops-default',
  description: 'A placeholder monster for scaling tests.',
  rarity: 'normal',
  variantOf: null,
};

describe('getScaledStats', () => {
  it('floor 1에서 기본 스탯을 반환한다', () => {
    const scaled = getScaledStats(baseMonster, 1);
    expect(scaled.hp).toBe(10);
    expect(scaled.atk).toBe(2);
    expect(scaled.def).toBe(1);
    expect(scaled.floorMultiplier).toBe(1);
    expect(scaled.rarityMultiplier).toBe(1);
  });

  it('층당 1% 선형 스케일링을 적용한다', () => {
    const scaled = getScaledStats(baseMonster, 10);
    // floorMultiplier: 1 + 0.01 * (10 - 1) = 1.09
    expect(scaled.hp).toBe(11); // 10 * 1.09 = 10.9 → round
    expect(scaled.atk).toBe(2); // 2 * 1.09 = 2.18 → round
    expect(scaled.def).toBe(1); // 1 * 1.09 = 1.09 → round
  });

  it('엘리트 계수를 곱해 스케일링한다', () => {
    const eliteMonster: CatalogMonster = { ...baseMonster, rarity: 'elite' };
    const scaled = getScaledStats(eliteMonster, 1);
    expect(scaled.hp).toBe(13); // 10 * 1.3 → round
    expect(scaled.atk).toBe(3); // 2 * 1.3 = 2.6 → round
    expect(scaled.rarityMultiplier).toBe(1.3);
  });

  it('baseFloor보다 낮은 층 입력을 클램프한다', () => {
    const scaled = getScaledStats(baseMonster, 0);
    expect(scaled.floor).toBe(1);
    expect(scaled.hp).toBe(10);
  });
});

describe('MonsterRegistry', () => {
  it('몬스터 메타와 스케일링 결과를 조회한다', () => {
    const registry = MonsterRegistry.from([baseMonster]);
    const result = registry.getScaledMonster(baseMonster.code, 5);
    expect(result.meta.code).toBe(baseMonster.code);
    expect(result.stats.floor).toBe(5);
  });

  it('없는 몬스터 code 조회 시 에러를 던진다', () => {
    const registry = MonsterRegistry.from([baseMonster]);
    expect(() => registry.getMeta('unknown-code')).toThrow(
      /Unknown monster code/,
    );
  });
});
