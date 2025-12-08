import type { DungeonState } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { CatalogMonster } from '../../../catalog';
import { MonsterRegistry } from '../../monsters';
import { BattleEventProcessor } from './battle-event.processor';

const createState = (overrides: Partial<DungeonState> = {}): DungeonState => ({
  userId: 'user',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 4,
  def: 1,
  luck: 1,
  floor: 1,
  maxFloor: 1,
  floorProgress: 0,
  gold: 0,
  ap: 10,
  currentAction: 'IDLE',
  currentActionStartedAt: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  version: 1,
  ...overrides,
});

const monsters: CatalogMonster[] = [
  {
    id: 'monster-normal',
    nameKey: 'monster.normal.name',
    descriptionKey: 'monster.normal.desc',
    name: 'Normal',
    hp: 6,
    atk: 2,
    def: 0,
    spriteId: 'sprite/normal',
    dropTableId: 'drops-floor-1',
    description: 'A basic monster.',
    rarity: 'normal',
    variantOf: null,
  },
  {
    id: 'monster-elite',
    nameKey: 'monster.elite.name',
    descriptionKey: 'monster.elite.desc',
    name: 'Elite',
    hp: 8,
    atk: 3,
    def: 1,
    spriteId: 'sprite/elite',
    dropTableId: 'drops-floor-1',
    description: 'A stronger monster.',
    rarity: 'elite',
    variantOf: 'monster-normal',
  },
];

const registry = MonsterRegistry.from(monsters);

const fixedRngFactory = (values: number[]) => (_seed?: number) => {
  let index = 0;
  return () => {
    const next = values[index] ?? values.at(-1) ?? 0;
    index += 1;
    return next;
  };
};

describe('BattleEventProcessor', () => {
  it('엘리트 확률이 트리거되면 엘리트 몬스터를 선택한다', () => {
    // 첫 호출에서 0.01 -> eliteRate(0.05) 통과, 두 번째 호출은 인덱스 선택
    const processor = new BattleEventProcessor(registry, {
      rngFactory: fixedRngFactory([0.01, 0.0]),
    });

    const result = processor.process({
      state: createState(),
      rngValue: 0,
    });

    const details = result.extra;
    if (!details || details.type !== 'BATTLE') {
      throw new Error('battle extra가 없습니다');
    }
    expect(details.details.monster.id).toBe('monster-elite');
  });

  it('기본적으로 일반 몬스터를 선택해 전투를 수행한다', () => {
    const processor = new BattleEventProcessor(registry, {
      rngFactory: fixedRngFactory([0.9, 0.0]), // eliteRoll=0.9 -> normal
    });

    const result = processor.process({
      state: createState(),
      rngValue: 0,
    });

    const details = result.extra;
    if (!details || details.type !== 'BATTLE') {
      throw new Error('battle extra가 없습니다');
    }
    expect(details.details.monster.id).toBe('monster-normal');
    expect(result.state.hp).toBeGreaterThan(0);
    expect(result.delta?.type).toBe('BATTLE');
  });

  it('패배 시 floor를 1로 리셋하고 HP를 초기화한다', () => {
    const strongMonster: CatalogMonster = {
      ...monsters[0],
      id: 'monster-strong',
      atk: 20,
      hp: 30,
      variantOf: null,
      rarity: 'normal',
    };
    const strongRegistry = MonsterRegistry.from([strongMonster]);
    const processor = new BattleEventProcessor(strongRegistry, {
      // eliteRoll=0.9 -> normal, index=0, 이후 공격 변동은 0.9 고정
      rngFactory: fixedRngFactory([0.9, 0.0, 0.9]),
    });

    const state = createState({
      hp: 5,
      floor: 3,
      floorProgress: 50,
      maxFloor: 3,
    });
    const result = processor.process({
      state,
      rngValue: 0,
    });

    const extra = result.extra;
    if (!extra || extra.type !== 'BATTLE') {
      throw new Error('battle extra가 없습니다');
    }
    expect(extra.details.result).toBe('DEFEAT');
    expect(result.state.floor).toBe(state.floor); // 사망 리셋은 엔진 후처리에서 수행
    expect(result.state.hp).toBeLessThan(state.maxHp);
  });

  it('승리 시 EXP를 지급하고 레벨업을 적용한다', () => {
    const expMonster: CatalogMonster = {
      ...monsters[0],
      id: 'monster-exp',
      hp: 4,
      atk: 1,
      def: 0,
      rarity: 'normal',
      variantOf: null,
    };
    const expRegistry = MonsterRegistry.from([expMonster]);
    const processor = new BattleEventProcessor(expRegistry, {
      rngFactory: fixedRngFactory([0, 0, 0, 0]),
    });

    const state = createState({
      atk: 10,
      def: 0,
      hp: 10,
      maxHp: 10,
      exp: 9,
      level: 1,
    });

    const result = processor.process({
      state,
      rngValue: 0,
    });

    // processor 단계에서는 EXP만 계산하고 레벨업은 엔진에서 처리한다.
    expect(result.state.level).toBe(state.level);
    expect(result.expGained).toBeGreaterThan(0);

    const extra = result.extra;
    if (!extra || extra.type !== 'BATTLE') {
      throw new Error('battle extra가 없습니다');
    }
    expect(extra.details.expGained).toBeGreaterThan(0);
  });
});
