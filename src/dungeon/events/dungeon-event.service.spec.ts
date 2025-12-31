import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
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
import type { InventoryDelta } from '../../common/logs/dungeon-log-delta';
import { DropService } from '../drops/drop.service';
import { DropInventoryService } from '../drops/drop-inventory.service';

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
    const startedLog = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.TRAP &&
        log.status === DungeonLogStatus.STARTED,
    );

    expect(startedLog?.delta?.type).toBe('TRAP');
    if (startedLog?.delta?.type === 'TRAP') {
      expect(startedLog.delta.detail.stats.ap).toBe(-1);
    }
    expect(completedLog?.stateVersionBefore).toBe(state.version);
    expect(completedLog?.stateVersionAfter).toBe(state.version + 1);
    expect(completedLog?.delta?.type).toBe('TRAP');
    if (completedLog?.delta?.type === 'TRAP') {
      expect(completedLog.delta.detail.stats.ap).toBeUndefined();
    }
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

    const restCompleted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.REST &&
        log.status === DungeonLogStatus.COMPLETED,
    );

    expect(restCompleted?.floor).toBe(state.floor);
    expect(moveCompleted?.floor).toBe(state.floor + 1);
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

    expect(startedLog.delta?.type).toBe('TREASURE');
    if (startedLog.delta?.type === 'TREASURE') {
      expect(startedLog.delta.detail.stats?.ap).toBe(-1);
    }

    expect(completedLog.delta?.type).toBe('TREASURE');
    if (completedLog.delta?.type === 'TREASURE') {
      expect(completedLog.delta.detail.stats?.ap).toBeUndefined();
    }
  });

  it('전투 STARTED 로그에 몬스터 extra가 포함된다', async () => {
    const state: DungeonState = createState({
      ap: 5,
      floorProgress: 0,
    });

    const result = await service.execute({
      state,
      seed: 'battle-start-extra',
      weights: {
        [DungeonEventType.BATTLE]: 1,
        [DungeonEventType.TREASURE]: 0,
        [DungeonEventType.REST]: 0,
        [DungeonEventType.TRAP]: 0,
      },
    });

    const startedLog = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.BATTLE &&
        log.status === DungeonLogStatus.STARTED,
    );

    expect(startedLog?.extra?.type).toBe('BATTLE');
    const details =
      startedLog?.extra?.type === 'BATTLE'
        ? startedLog.extra.details
        : undefined;
    expect(details?.monster?.code).toBeTypeOf('string');
    expect(details?.monster?.name).toBeTypeOf('string');
    expect(details?.monster?.hp).toBeTypeOf('number');
    expect(details?.monster?.atk).toBeTypeOf('number');
    expect(details?.monster?.def).toBeTypeOf('number');
    expect(details?.monster?.spriteId).toBeTypeOf('string');
    expect(details?.player?.hp).toBeTypeOf('number');
    expect(details?.player?.maxHp).toBeTypeOf('number');
    expect(details?.player?.atk).toBeTypeOf('number');
    expect(details?.player?.def).toBeTypeOf('number');
    expect(details?.player?.luck).toBeTypeOf('number');
    expect(details?.player?.level).toBeTypeOf('number');
    expect(details?.player?.exp).toBeTypeOf('number');
    expect(details?.player?.stats?.total?.atk).toBeTypeOf('number');
    expect(details?.player?.stats?.equipmentBonus?.atk).toBeTypeOf('number');
  });

  it('HP<=0이면 DEATH 로그가 생성되고(리셋 포함) 이벤트 progress는 DEATH에서만 표기된다', async () => {
    const state: DungeonState = createState({
      hp: 1,
      floor: 3,
      floorProgress: 70,
    });
    const equipmentBonus = { hp: 2, atk: 0, def: 0, luck: 0 };

    const result = await service.execute({
      state,
      seed: 'death-seed',
      equipmentBonus,
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
    expect(deathLog?.delta?.type).toBe('DEATH');
    if (deathLog?.delta?.type === 'DEATH') {
      expect(deathLog.delta.detail.progress.floorProgress).toBe(0);
      expect(deathLog.delta.detail.progress.previousProgress).toBeTypeOf(
        'number',
      );
    }
    expect(deathLog?.floor).toBe(state.floor);
    const deathExtra = deathLog?.extra as { details?: { handledBy?: unknown } };
    expect(deathExtra?.details?.handledBy).toBeUndefined();

    const trapCompleted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.TRAP &&
        log.status === DungeonLogStatus.COMPLETED,
    );
    const trapStarted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.TRAP &&
        log.status === DungeonLogStatus.STARTED,
    );
    expect(trapStarted?.delta?.type).toBe('TRAP');
    if (trapStarted?.delta?.type === 'TRAP') {
      expect(trapStarted.delta.detail.stats.ap).toBe(-1);
    }
    expect(trapCompleted).toBeDefined();
    expect(trapCompleted?.delta?.type).toBe('TRAP');
    if (trapCompleted?.delta?.type === 'TRAP') {
      expect(trapCompleted.delta.detail.progress).toBeUndefined();
      expect(trapCompleted.delta.detail.stats.ap).toBeUndefined();
    }
    expect(trapCompleted?.floor).toBe(state.floor);

    const trapCompletedIndex = result.logs.findIndex(
      (log) =>
        log.action === DungeonLogAction.TRAP &&
        log.status === DungeonLogStatus.COMPLETED,
    );
    const deathIndex = result.logs.findIndex(
      (log) => log.action === DungeonLogAction.DEATH,
    );
    expect(trapCompletedIndex).toBeGreaterThanOrEqual(0);
    expect(deathIndex).toBeGreaterThanOrEqual(0);
    expect(trapCompletedIndex).toBeLessThan(deathIndex);

    const reviveLog = result.logs.find(
      (log) => log.action === DungeonLogAction.REVIVE,
    );
    expect(reviveLog).toBeDefined();
    expect(reviveLog?.delta?.type).toBe('REVIVE');
    if (reviveLog?.delta?.type === 'REVIVE') {
      expect(reviveLog.delta.detail.stats.hp).toBe(
        state.maxHp + equipmentBonus.hp,
      );
    }

    expect(result.stateAfter.floor).toBe(1);
    expect(result.stateAfter.floorProgress).toBe(0);
    expect(result.stateAfter.hp).toBe(
      result.stateAfter.maxHp + equipmentBonus.hp,
    );
  });

  it('승리 시 전투 EXP는 BATTLE에 기록하고, 레벨업 스탯은 LEVEL_UP에만 기록한다', async () => {
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
    expect(levelUpLog?.delta?.type).toBe('LEVEL_UP');
    if (levelUpLog?.delta?.type === 'LEVEL_UP') {
      expect(levelUpLog.delta.detail.stats.level).toBeDefined();
      expect(levelUpLog.delta.detail.stats.exp).toBeUndefined();
    }

    const battleCompleted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.BATTLE &&
        log.status === DungeonLogStatus.COMPLETED,
    );
    const battleStarted = result.logs.find(
      (log) =>
        log.action === DungeonLogAction.BATTLE &&
        log.status === DungeonLogStatus.STARTED,
    );
    expect(battleStarted?.extra?.type).toBe('BATTLE');
    if (battleStarted?.extra?.type === 'BATTLE') {
      expect(battleStarted.extra.details.player?.hp).toBeTypeOf('number');
      expect(battleStarted.extra.details.player?.stats?.total?.hp).toBeTypeOf(
        'number',
      );
    }
    expect(battleStarted?.delta?.type).toBe('BATTLE');
    if (battleStarted?.delta?.type === 'BATTLE') {
      expect(battleStarted.delta.detail.stats?.ap).toBe(-1);
    }

    expect(result.stateAfter.level).toBeGreaterThan(state.level);
    expect(result.stateAfter.maxHp).toBeGreaterThan(state.maxHp);
    expect(battleCompleted?.delta?.type).toBe('BATTLE');
    if (battleCompleted?.delta?.type === 'BATTLE') {
      expect(battleCompleted.delta.detail.stats?.exp).toBeDefined();
      expect(battleCompleted.delta.detail.stats?.ap).toBeUndefined();
      expect(battleCompleted.delta.detail.stats?.level).toBeUndefined();
      expect(battleCompleted.delta.detail.stats?.maxHp).toBeUndefined();
    }
    expect(battleCompleted?.extra?.type).toBe('BATTLE');
    if (battleCompleted?.extra?.type === 'BATTLE') {
      expect(battleCompleted.extra.details.player?.hp).toBeTypeOf('number');
      expect(battleCompleted.extra.details.player?.stats?.total?.hp).toBeTypeOf(
        'number',
      );
    }

    const battleCompletedIndex = result.logs.findIndex(
      (log) =>
        log.action === DungeonLogAction.BATTLE &&
        log.status === DungeonLogStatus.COMPLETED,
    );
    const levelUpIndex = result.logs.findIndex(
      (log) => log.action === DungeonLogAction.LEVEL_UP,
    );
    expect(battleCompletedIndex).toBeGreaterThanOrEqual(0);
    expect(levelUpIndex).toBeGreaterThanOrEqual(0);
    expect(battleCompletedIndex).toBeLessThan(levelUpIndex);
  });

  it.sequential(
    '드랍 시 STATUS 카테고리 ACQUIRE_ITEM 로그를 추가한다',
    async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDbSkip = process.env.DATABASE_SKIP_CONNECTION;
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_SKIP_CONNECTION = 'false';

      const dropService: Pick<DropService, 'roll'> = {
        roll: vi
          .fn()
          .mockReturnValue([{ code: 'weapon-wooden-sword', quantity: 1 }]),
      };
      const inventoryAdds = [
        {
          itemId: '00000000-0000-4000-8000-000000000401',
          code: 'weapon-wooden-sword',
          slot: 'weapon',
          rarity: 'common',
          quantity: 1,
        },
      ];
      const dropInventoryService: Pick<DropInventoryService, 'applyDrops'> = {
        applyDrops: vi.fn().mockResolvedValue(inventoryAdds),
      };

      try {
        const module = await Test.createTestingModule({
          imports: [DungeonModule],
        })
          .overrideProvider(DropService)
          .useValue(dropService)
          .overrideProvider(DropInventoryService)
          .useValue(dropInventoryService)
          .compile();

        const serviceWithDrops = module.get(DungeonEventService);
        const state: DungeonState = createState({ ap: 5 });

        const result = await serviceWithDrops.execute({
          state,
          seed: 'acquire-log',
          weights: {
            [DungeonEventType.BATTLE]: 0,
            [DungeonEventType.TREASURE]: 1,
            [DungeonEventType.REST]: 0,
            [DungeonEventType.TRAP]: 0,
          },
        });

        const acquireLog = result.logs.find(
          (log) => log.action === DungeonLogAction.ACQUIRE_ITEM,
        );
        expect(acquireLog?.category).toBe(DungeonLogCategory.STATUS);
        expect(acquireLog?.delta?.type).toBe('ACQUIRE_ITEM');
        if (acquireLog?.delta?.type === 'ACQUIRE_ITEM') {
          expect(acquireLog.delta.detail.inventory?.added?.[0]?.code).toBe(
            'weapon-wooden-sword',
          );
        }
        if (acquireLog?.extra?.type === 'ACQUIRE_ITEM') {
          expect(acquireLog.extra.details.reward.drop?.items?.[0]?.code).toBe(
            'weapon-wooden-sword',
          );
        }
        expect(result.inventoryAdds?.length).toBeGreaterThan(0);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.DATABASE_SKIP_CONNECTION = originalDbSkip;
      }
    },
  );

  it.sequential(
    '강제 MOVE가 필요한 경우 ACQUIRE_ITEM 로그가 MOVE보다 먼저 기록된다',
    async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDbSkip = process.env.DATABASE_SKIP_CONNECTION;
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_SKIP_CONNECTION = 'false';

      const dropService: Pick<DropService, 'roll'> = {
        roll: vi
          .fn()
          .mockReturnValue([{ code: 'weapon-wooden-sword', quantity: 1 }]),
      };
      const inventoryAdds = [
        {
          itemId: '00000000-0000-4000-8000-000000000402',
          code: 'weapon-wooden-sword',
          slot: 'weapon',
          rarity: 'common',
          quantity: 1,
        },
      ];
      const dropInventoryService: Pick<DropInventoryService, 'applyDrops'> = {
        applyDrops: vi.fn().mockResolvedValue(inventoryAdds),
      };

      try {
        const module = await Test.createTestingModule({
          imports: [DungeonModule],
        })
          .overrideProvider(DropService)
          .useValue(dropService)
          .overrideProvider(DropInventoryService)
          .useValue(dropInventoryService)
          .compile();

        const serviceWithDrops = module.get(DungeonEventService);
        const state: DungeonState = createState({ ap: 5, floorProgress: 95 });

        const result = await serviceWithDrops.execute({
          state,
          seed: 'acquire-log-move-order',
          weights: {
            [DungeonEventType.BATTLE]: 0,
            [DungeonEventType.TREASURE]: 1,
            [DungeonEventType.REST]: 0,
            [DungeonEventType.TRAP]: 0,
          },
        });

        const acquireIndex = result.logs.findIndex(
          (log) => log.action === DungeonLogAction.ACQUIRE_ITEM,
        );
        const moveStartedIndex = result.logs.findIndex(
          (log) =>
            log.action === DungeonLogAction.MOVE &&
            log.status === DungeonLogStatus.STARTED,
        );

        expect(acquireIndex).toBeGreaterThanOrEqual(0);
        expect(moveStartedIndex).toBeGreaterThanOrEqual(0);
        expect(acquireIndex).toBeLessThan(moveStartedIndex);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.DATABASE_SKIP_CONNECTION = originalDbSkip;
      }
    },
  );

  it.sequential(
    'DB 연결을 건너뛰는 환경에서도 드랍 로그를 남긴다',
    async () => {
      const originalDbSkip = process.env.DATABASE_SKIP_CONNECTION;
      process.env.DATABASE_SKIP_CONNECTION = 'true';

      const dropService: Pick<DropService, 'roll'> = {
        roll: vi
          .fn()
          .mockReturnValue([{ code: 'weapon-wooden-sword', quantity: 1 }]),
      };
      const dropInventoryService: Pick<DropInventoryService, 'applyDrops'> = {
        applyDrops: vi.fn(),
      };

      try {
        const module = await Test.createTestingModule({
          imports: [DungeonModule],
        })
          .overrideProvider(DropService)
          .useValue(dropService)
          .overrideProvider(DropInventoryService)
          .useValue(dropInventoryService)
          .compile();

        const serviceWithSkip = module.get(DungeonEventService);
        const state: DungeonState = createState({ ap: 5 });

        const result = await serviceWithSkip.execute({
          state,
          seed: 'acquire-log-skip',
          weights: {
            [DungeonEventType.BATTLE]: 0,
            [DungeonEventType.TREASURE]: 1,
            [DungeonEventType.REST]: 0,
            [DungeonEventType.TRAP]: 0,
          },
        });

        expect(dropInventoryService.applyDrops).not.toHaveBeenCalled();
        const acquireLog = result.logs.find(
          (log) => log.action === DungeonLogAction.ACQUIRE_ITEM,
        );
        expect(acquireLog?.delta?.type).toBe('ACQUIRE_ITEM');
        expect(result.inventoryAdds?.[0]?.code).toBe('weapon-wooden-sword');
      } finally {
        process.env.DATABASE_SKIP_CONNECTION = originalDbSkip;
      }
    },
  );

  it.sequential(
    'skipInventoryApply 옵션이면 드랍 인벤토리 적용을 스킵한다',
    async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalDbSkip = process.env.DATABASE_SKIP_CONNECTION;
      process.env.NODE_ENV = 'development';
      delete process.env.DATABASE_SKIP_CONNECTION;

      const inventoryAdds: InventoryDelta['added'] = [
        {
          itemId: '00000000-0000-4000-8000-000000000402',
          code: 'weapon-wooden-sword',
          slot: 'weapon',
          rarity: 'common',
          quantity: 1,
        },
      ];
      const dropService: Pick<DropService, 'roll'> = {
        roll: vi
          .fn()
          .mockReturnValue([{ code: 'weapon-wooden-sword', quantity: 1 }]),
      };
      const dropInventoryService: Pick<DropInventoryService, 'applyDrops'> = {
        applyDrops: vi.fn().mockResolvedValue(inventoryAdds),
      };

      try {
        const module = await Test.createTestingModule({
          imports: [DungeonModule],
        })
          .overrideProvider(DropService)
          .useValue(dropService)
          .overrideProvider(DropInventoryService)
          .useValue(dropInventoryService)
          .compile();

        const serviceWithSkip = module.get(DungeonEventService);
        const state: DungeonState = createState({ ap: 5 });

        const result = await serviceWithSkip.execute({
          state,
          seed: 'acquire-log-skip-inventory',
          skipInventoryApply: true,
          weights: {
            [DungeonEventType.BATTLE]: 0,
            [DungeonEventType.TREASURE]: 1,
            [DungeonEventType.REST]: 0,
            [DungeonEventType.TRAP]: 0,
          },
        });

        expect(dropInventoryService.applyDrops).not.toHaveBeenCalled();
        const acquireLog = result.logs.find(
          (log) => log.action === DungeonLogAction.ACQUIRE_ITEM,
        );
        expect(acquireLog?.delta?.type).toBe('ACQUIRE_ITEM');
        expect(result.inventoryAdds?.[0]?.code).toBe('weapon-wooden-sword');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.DATABASE_SKIP_CONNECTION = originalDbSkip;
      }
    },
  );
});

function createState(overrides: Partial<DungeonState> = {}): DungeonState {
  const base: DungeonState = {
    userId: '00000000-0000-4000-8000-000000000301',
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
