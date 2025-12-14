import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
  type EffectDelta,
} from '../event.types';
import type {
  BuffAppliedDelta,
  InventoryDelta,
} from '../../../common/logs/dungeon-log-delta';
import { applyEffectDelta } from '../effect-applier';
import type { DropService } from '../../drops/drop.service';
import { DEFAULT_DROP_TABLE_ID } from '../../drops/drop.service';
import {
  SEEDED_RNG_FACTORY,
  SeededRandomFactory,
} from '../seeded-rng.provider';
import { Inject } from '@nestjs/common';

export class TreasureEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.TREASURE;

  constructor(
    private readonly effect: EffectDelta = {},
    @Inject(SEEDED_RNG_FACTORY)
    private readonly rngFactory?: SeededRandomFactory,
    private readonly dropService?: DropService,
  ) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const rng =
      this.rngFactory?.create(String(input.rngValue)) ??
      this.createFallbackRng(input.rngValue);

    const baseGold = this.effect.rewards?.gold ?? 0;
    const goldDelta = baseGold;
    const applied = applyEffectDelta(input.state, {
      ...this.effect,
      rewards: {
        ...(this.effect.rewards ?? {}),
        gold: goldDelta,
      },
    });

    const drops = this.rollDrops(rng);
    const dropMeta =
      drops.length > 0
        ? {
            tableId: DEFAULT_DROP_TABLE_ID,
            isElite: false,
            items: drops.map((drop) => ({
              itemCode: drop.itemCode,
              quantity: drop.quantity,
            })),
          }
        : undefined;
    const baseAdds = this.toInventoryAdds(this.effect.rewards?.items);
    const rewardItems = [
      ...this.toRewardItems(baseAdds),
      ...drops.map((drop) => ({
        itemCode: drop.itemCode,
        quantity: drop.quantity,
      })),
    ];

    return {
      state: applied.state,
      delta: {
        type: 'TREASURE',
        detail: {
          rewards: {
            gold: applied.rewardsDelta.gold ?? goldDelta,
            items: rewardItems,
            buffs: this.toAppliedBuffs(this.effect.rewards?.buffs),
            unlocks: [],
          },
        },
      },
      drops,
      dropMeta,
    };
  }

  private toInventoryAdds(
    items: EffectDelta['rewards'] extends { items: infer T } ? T : unknown,
  ): InventoryDelta['added'] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter(
      (it): it is NonNullable<InventoryDelta['added']>[number] => {
        return (
          typeof it === 'object' &&
          it !== null &&
          'code' in it &&
          'slot' in it &&
          'itemId' in it &&
          typeof (it as { code?: unknown }).code === 'string' &&
          typeof (it as { slot?: unknown }).slot === 'string' &&
          typeof (it as { itemId?: unknown }).itemId === 'string'
        );
      },
    );
  }

  private toRewardItems(
    adds: InventoryDelta['added'] | undefined,
  ): Array<{ itemCode: string; quantity?: number }> {
    if (!adds?.length) return [];
    return adds.map((it) => ({
      itemCode: it.code,
      quantity: it.quantity ?? 1,
    }));
  }

  private toAppliedBuffs(
    buffs: EffectDelta['rewards'] extends { buffs: infer T } ? T : unknown,
  ): BuffAppliedDelta['detail']['applied'] {
    if (!Array.isArray(buffs)) {
      return [];
    }

    return buffs.filter(
      (buff): buff is BuffAppliedDelta['detail']['applied'][number] =>
        typeof buff === 'object' &&
        buff !== null &&
        'buffId' in buff &&
        typeof (buff as { buffId?: unknown }).buffId === 'string',
    );
  }

  private rollDrops(rng: {
    next: () => number;
  }): NonNullable<DungeonEventProcessorOutput['drops']> {
    if (!this.dropService) return [];
    return this.dropService.roll({
      tableId: DEFAULT_DROP_TABLE_ID,
      rng,
      isElite: false,
    });
  }

  private createFallbackRng(seedValue: number): { next: () => number } {
    // 간단한 LCG 기반 결정적 RNG: 동일 입력에 대해 동일 시퀀스 보장
    let seed = Math.floor((seedValue ?? 0) * 1e9) >>> 0;
    return {
      next: () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 0xffffffff;
      },
    };
  }
}
