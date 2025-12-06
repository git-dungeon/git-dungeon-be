import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
} from '../event.types';

const BASE_TREASURE_REWARD = 5;

export class TreasureEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.TREASURE;

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const bonus = Math.floor(input.rngValue * BASE_TREASURE_REWARD);
    const reward = BASE_TREASURE_REWARD + bonus;

    return {
      state: {
        ...input.state,
        gold: input.state.gold + reward,
      },
      delta: {
        type: 'TREASURE',
        detail: {
          gold: reward,
          rewards: {
            gold: reward,
            items: [],
            buffs: [],
            unlocks: [],
          },
        },
      },
    };
  }
}
