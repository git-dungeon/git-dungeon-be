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

export class TreasureEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.TREASURE;

  constructor(private readonly effect: EffectDelta = {}) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const baseGold = this.effect.rewards?.gold ?? 0;
    const gold = baseGold;
    const applied = applyEffectDelta(input.state, {
      ...this.effect,
      rewards: {
        ...(this.effect.rewards ?? {}),
        gold,
      },
    });

    return {
      state: applied.state,
      delta: {
        type: 'TREASURE',
        detail: {
          gold: applied.rewardsDelta.gold ?? gold,
          rewards: {
            gold,
            items: this.toInventoryAdds(this.effect.rewards?.items),
            buffs: this.toAppliedBuffs(this.effect.rewards?.buffs),
            unlocks: [],
          },
        },
      },
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
}
