import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
  type EffectDelta,
} from '../event.types';
import { applyEffectDelta } from '../effect-applier';

export class RestEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.REST;

  constructor(private readonly effect: EffectDelta = {}) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const maxHp = Math.max(
      0,
      input.state.maxHp + (input.equipmentBonus?.hp ?? 0),
    );
    const applied = applyEffectDelta(input.state, this.effect, { maxHp });

    return {
      state: applied.state,
      delta: {
        type: 'REST',
        detail: {
          stats: {
            ...applied.statsDelta,
          },
        },
      },
    };
  }
}
