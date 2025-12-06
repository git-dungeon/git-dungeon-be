import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
  type EffectDelta,
} from '../event.types';
import { applyEffectDelta } from '../effect-applier';

export class TrapEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.TRAP;

  constructor(private readonly effect: EffectDelta = {}) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const applied = applyEffectDelta(input.state, this.effect);

    return {
      state: applied.state,
      delta: {
        type: 'TRAP',
        detail: {
          stats: applied.statsDelta,
        },
      },
    };
  }
}
