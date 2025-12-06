import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DungeonLogAction,
  DungeonLogStatus,
  type DungeonState,
} from '@prisma/client';
import { DungeonEventService } from './dungeon-event.service';
import { DungeonModule } from '../dungeon.module';
import { DungeonEventType } from './event.types';

describe('DungeonEventService', () => {
  let service: DungeonEventService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DungeonModule],
    }).compile();

    service = module.get(DungeonEventService);
  });

  it('가중치 선택과 진행도 증가를 적용한다', () => {
    const state: DungeonState = createState({
      ap: 5,
      floorProgress: 0,
    });

    const result = service.execute({
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

  it('진행도가 100 이상이면 강제로 MOVE를 실행한다', () => {
    const state: DungeonState = createState({
      ap: 3,
      hp: 5,
      floorProgress: 95,
    });

    const result = service.execute({
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
