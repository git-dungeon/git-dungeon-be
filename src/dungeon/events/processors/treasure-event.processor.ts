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
import { mapDropsToInventoryAdds } from '../../drops/drop.utils';

export class TreasureEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.TREASURE;

  constructor(
    private readonly effect: EffectDelta = {},
    @Inject(SEEDED_RNG_FACTORY)
    private readonly rngFactory?: SeededRandomFactory,
    private readonly dropService?: DropService,
  ) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const rng = this.rngFactory?.create(String(input.rngValue)) ??
      // fallback: deterministic on rngValue
      { next: () => input.rngValue };

    const baseGold = this.effect.rewards?.gold ?? 0;
    const gold = baseGold;
    const applied = applyEffectDelta(input.state, {
      ...this.effect,
      rewards: {
        ...(this.effect.rewards ?? {}),
        gold,
      },
    });

    const drops = this.rollDrops(rng);
    const dropAdds = mapDropsToInventoryAdds(drops);
    const baseAdds = this.toInventoryAdds(this.effect.rewards?.items);

    return {
      state: applied.state,
      delta: {
        type: 'TREASURE',
        detail: {
          gold: applied.rewardsDelta.gold ?? gold,
          rewards: {
            gold,
            items: [...(baseAdds ?? []), ...(dropAdds ?? [])],
            buffs: this.toAppliedBuffs(this.effect.rewards?.buffs),
            unlocks: [],
          },
        },
      },
      drops,
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

  // TODO: T-M3-3-03에서 카탈로그 슬롯/희귀도 매핑 후 업데이트
}
