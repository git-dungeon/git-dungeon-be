import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
  TRAP_BASE_DAMAGE,
} from '../event.types';

export class TrapEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.TRAP;

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const damage = TRAP_BASE_DAMAGE;
    const nextHp = Math.max(0, input.state.hp - damage);

    return {
      state: {
        ...input.state,
        hp: nextHp,
      },
      delta: {
        type: 'TRAP',
        detail: {
          damage,
          hpBefore: input.state.hp,
          hpAfter: nextHp,
        },
      },
    };
  }
}
