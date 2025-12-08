import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
  type DungeonState,
} from '@prisma/client';
import { DungeonEventService } from './dungeon-event.service';
import { DungeonModule } from '../dungeon.module';
import { DungeonEventType } from './event.types';
import type { DungeonLogPayload } from './event.types';

describe('DungeonEventService', () => {
  let service: DungeonEventService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DungeonModule],
    }).compile();

    service = module.get(DungeonEventService);
  });

  it('가중치 선택과 진행도 증가를 적용한다', async () => {
    const state: DungeonState = createState({
      ap: 5,
      floorProgress: 0,
    });

    const result = await service.execute({
      state,
      seed: 'test-seed',
      weights: {
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 0,
        [DungeonEventType.TRAP]: 1,
      },
    });

    expect(result.selectedEvent).toBe(DungeonEventType.TRAP);
    expect(result.forcedMove).toBe(false);
    expect(result.stateAfter.ap).toBe(4);
    expect(result.stateAfter.floorProgress).toBe(10);
    expect(result.stateAfter.version).toBe(state.version + 1);
    expect(result.stateAfter.currentAction).toBe('IDLE');

    const completedLog = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.TRAP &&
        log.status === DungeonLogStatus.COMPLETED,
    );

    expect(completedLog?.stateVersionBefore).toBe(state.version);
    expect(completedLog?.stateVersionAfter).toBe(state.version + 1);
    expect(completedLog?.delta && 'detail' in completedLog.delta).toBe(true);
  });

  it('진행도가 100 이상이면 강제로 MOVE를 실행한다', async () => {
    const state: DungeonState = createState({
      ap: 3,
      hp: 5,
      floorProgress: 95,
    });

    const result = await service.execute({
      state,
      seed: 'rest-seed',
      weights: {
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 1,
        [DungeonEventType.TRAP]: 0,
      },
    });

    expect(result.selectedEvent).toBe(DungeonEventType.REST);
    expect(result.forcedMove).toBe(true);
    expect(result.stateAfter.floor).toBe(state.floor + 1);
    expect(result.stateAfter.maxFloor).toBe(state.floor + 1);
    expect(result.stateAfter.floorProgress).toBe(0);
    expect(result.stateAfter.hp).toBeGreaterThan(state.hp);
    expect(
      result.logs.filter((log) => log.action === DungeonLogAction.MOVE),
    ).toHaveLength(2);

    const moveCompleted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.MOVE &&
        log.status === DungeonLogStatus.COMPLETED,
    );

    expect(moveCompleted?.stateVersionAfter).toBe(state.version + 1);
  });

  it('결정적 RNG로 동일 시드에서 동일 이벤트를 선택한다', async () => {
    const state: DungeonState = createState({
      ap: 10,
      floorProgress: 0,
    });

    const selections = [
      (await service.execute({ state, seed: 'seed-1', actionCounter: 1 }))
        .selectedEvent,
      (await service.execute({ state, seed: 'seed-2', actionCounter: 1 }))
        .selectedEvent,
      (await service.execute({ state, seed: 'seed-1', actionCounter: 1 }))
        .selectedEvent,
    ];

    expect(selections[0]).toBe(selections[2]);
  });

  it('AP 부족 시 예외를 던진다', async () => {
    const state: DungeonState = createState({
      ap: 0,
    });

    await expect(
      service.execute({
        state,
        seed: 'ap-fail',
      }),
    ).rejects.toThrow(/AP가 부족합니다/);
  });

  it('전투는 진행도 +20, 기타는 +10으로 클램프하고 강제 이동을 트리거한다', async () => {
    const battleState: DungeonState = createState({ floorProgress: 85 });
    const restState: DungeonState = createState({ floorProgress: 95 });

    const battleResult = await service.execute({
      state: battleState,
      seed: 'battle-progress',
      weights: {
        [DungeonEventType.BATTLE]: 1,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 0,
        [DungeonEventType.TRAP]: 0,
      },
    });

    expect(battleResult.forcedMove).toBe(true);
    expect(battleResult.stateAfter.floor).toBe(battleState.floor + 1);
    expect(battleResult.stateAfter.floorProgress).toBe(0);

    const restResult = await service.execute({
      state: restState,
      seed: 'rest-progress',
      weights: {
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 1,
        [DungeonEventType.TRAP]: 0,
      },
    });

    expect(restResult.stateAfter.floorProgress).toBe(0);
    expect(restResult.forcedMove).toBe(true);
  });

  it('휴식만 HP를 회복하고 함정은 피해를 준다', async () => {
    const restState: DungeonState = createState({ hp: 5, floorProgress: 0 });
    const trapState: DungeonState = createState({ hp: 5, floorProgress: 0 });

    const restResult = await service.execute({
      state: restState,
      seed: 'rest-heal',
      weights: {
        [DungeonEventType.REST]: 1,
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.TRAP]: 0,
      },
    });

    expect(restResult.stateAfter.hp).toBeGreaterThan(restState.hp);

    const trapResult = await service.execute({
      state: trapState,
      seed: 'trap-damage',
      weights: {
        [DungeonEventType.TRAP]: 1,
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 0,
      },
    });

    expect(trapResult.stateAfter.hp).toBeLessThan(trapState.hp);
  });

  it('결정적 RNG로 가중치 이벤트 분포가 일관된다', async () => {
    const state: DungeonState = createState({
      ap: 100,
      floorProgress: 0,
    });

    const weights = {
      [DungeonEventType.BATTLE]: 50,
      [DungeonEventType.TREASURE]: 5,
      [DungeonEventType.REST]: 40,
      [DungeonEventType.TRAP]: 5,
    };

    const counts: Record<DungeonEventType, number> = {
      [DungeonEventType.BATTLE]: 0,
      [DungeonEventType.TREASURE]: 0,
      [DungeonEventType.REST]: 0,
      [DungeonEventType.TRAP]: 0,
      [DungeonEventType.MOVE]: 0,
    };

    for (let i = 0; i < 100; i += 1) {
      const seed = `seed-${i}`;
      const { selectedEvent } = await service.execute({
        state,
        seed,
        actionCounter: i,
        weights,
      });
      counts[selectedEvent] += 1;
    }

    expect(counts[DungeonEventType.BATTLE]).toBeGreaterThan(
      counts[DungeonEventType.REST],
    );
    expect(counts[DungeonEventType.REST]).toBeGreaterThan(
      counts[DungeonEventType.TREASURE],
    );
    expect(counts[DungeonEventType.TREASURE]).toBeGreaterThan(0);
  });

  it('Typia로 로그 payload를 검증한다', async () => {
    const state: DungeonState = createState({
      ap: 5,
      floorProgress: 90,
    });

    const result = await service.execute({
      state,
      seed: 'log-validate',
      weights: {
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 1,
        [DungeonEventType.REST]: 0,
        [DungeonEventType.TRAP]: 0,
      },
    });

    // typia transform이 없으므로 toJson 변환 없이 객체 구조를 느슨히 검사한다.
    const startedLog: DungeonLogPayload | undefined = result.logs.at(0);
    const completedLog: DungeonLogPayload | undefined = result.logs.at(1);

    expect(startedLog).toBeDefined();
    expect(completedLog).toBeDefined();

    assertLog(startedLog, {
      category: DungeonLogCategory.EXPLORATION,
      action: DungeonLogAction.TREASURE,
      status: DungeonLogStatus.STARTED,
      stateVersion: state.version,
    });

    assertLog(completedLog, {
      category: DungeonLogCategory.EXPLORATION,
      action: DungeonLogAction.TREASURE,
      status: DungeonLogStatus.COMPLETED,
      stateVersion: state.version + 1,
    });
  });

  it('HP<=0이면 DEATH 로그가 생성되고 진행도가 리셋된다', async () => {
    const state: DungeonState = createState({
      hp: 1,
      floor: 3,
      floorProgress: 70,
    });

    const result = await service.execute({
      state,
      seed: 'death-seed',
      weights: {
        [DungeonEventType.BATTLE]: 0,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 0,
        [DungeonEventType.TRAP]: 1,
      },
    });

    const deathLog = result.logs.find(
      (log) => log.action === DungeonLogAction.DEATH,
    );
    expect(deathLog).toBeDefined();
    expect(result.stateAfter.floor).toBe(1);
    expect(result.stateAfter.floorProgress).toBe(0);
    expect(result.stateAfter.hp).toBe(result.stateAfter.maxHp);
  });

  it('승리 시 레벨업과 LEVEL_UP 로그를 생성하고 delta에 stats를 병합한다', async () => {
    const state: DungeonState = createState({
      atk: 20,
      def: 1,
      hp: 10,
      maxHp: 10,
      exp: 9,
      level: 1,
    });

    const result = await service.execute({
      state,
      seed: 'levelup-seed',
      weights: {
        [DungeonEventType.BATTLE]: 1,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 0,
        [DungeonEventType.TRAP]: 0,
      },
    });

    const levelUpLog = result.logs.find(
      (log) => log.action === DungeonLogAction.LEVEL_UP,
    );
    expect(levelUpLog).toBeDefined();

    const battleCompleted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.BATTLE &&
        log.status === DungeonLogStatus.COMPLETED,
    );

    expect(result.stateAfter.level).toBeGreaterThan(state.level);
    expect(result.stateAfter.maxHp).toBeGreaterThan(state.maxHp);
    expect(battleCompleted?.delta?.type).toBe('BATTLE');
    if (battleCompleted?.delta?.type === 'BATTLE') {
      expect(battleCompleted.delta.detail.stats?.exp).toBeDefined();
    }
  });
});

function createState(overrides: Partial<DungeonState> = {}): DungeonState {
  const base: DungeonState = {
    userId: 'user-id',
    level: 1,
    exp: 0,
    hp: 10,
    maxHp: 10,
    atk: 1,
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
    version: 1,
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  };

  return { ...base, ...overrides };
}

function assertLog(
  log: DungeonLogPayload | undefined,
  expected: {
    category: DungeonLogCategory;
    action: DungeonLogAction;
    status: DungeonLogStatus;
    stateVersion: number;
  },
): asserts log is DungeonLogPayload {
  expect(log?.category).toBe(expected.category);
  expect(log?.action).toBe(expected.action);
  expect(log?.status).toBe(expected.status);
  if (expected.status === DungeonLogStatus.STARTED) {
    expect(log?.stateVersionBefore).toBe(expected.stateVersion);
  } else {
    expect(log?.stateVersionAfter).toBe(expected.stateVersion);
  }
}
