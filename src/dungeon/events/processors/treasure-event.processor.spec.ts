import { describe, expect, it, vi } from 'vitest';
import { TreasureEventProcessor } from './treasure-event.processor';
import type { DropService } from '../../drops/drop.service';
import type { DungeonState } from '@prisma/client';

const createState = (overrides: Partial<DungeonState> = {}): DungeonState => ({
  userId: 'user',
  level: 1,
  exp: 0,
  hp: 10,
  maxHp: 10,
  atk: 1,
  def: 1,
  luck: 1,
  levelUpPoints: 0,
  levelUpRollIndex: 0,
  unopenedChests: 0,
  chestRollIndex: 0,
  equipmentBonus: null,
  statsVersion: 0,
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

describe('TreasureEventProcessor', () => {
  it('드랍 엔진을 호출해 기본 테이블 드랍을 반환하고 delta에 병합한다', () => {
    const dropService: Pick<DropService, 'roll'> = {
      roll: vi
        .fn()
        .mockReturnValue([{ code: 'weapon-wooden-sword', quantity: 1 }]),
    };
    const processor = new TreasureEventProcessor(
      {
        rewards: {
          gold: 5,
        },
      },
      undefined,
      dropService as DropService,
    );

    const result = processor.process({
      state: createState(),
      rngValue: 0.42,
    });

    expect(dropService.roll).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'drops-default',
      }),
    );
    expect(result.drops).toEqual([
      { code: 'weapon-wooden-sword', quantity: 1 },
    ]);
    expect(result.dropMeta).toEqual({
      tableId: 'drops-default',
      isElite: false,
      items: [{ code: 'weapon-wooden-sword', quantity: 1 }],
    });
    expect(result.delta?.type).toBe('TREASURE');
    if (result.delta?.type === 'TREASURE') {
      expect(result.delta.detail.rewards?.items).toEqual([
        { code: 'weapon-wooden-sword', quantity: 1 },
      ]);
    }
  });
});
