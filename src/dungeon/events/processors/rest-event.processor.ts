import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
  REST_HEAL_RATIO,
  REST_MIN_HEAL,
} from '../event.types';

type RestOptions = {
  healRatio?: number;
  minHeal?: number;
};

export class RestEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.REST;

  constructor(private readonly options: RestOptions = {}) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const { healRatio = REST_HEAL_RATIO, minHeal = REST_MIN_HEAL } =
      this.options;

    const healAmount = Math.max(
      minHeal,
      Math.floor(input.state.maxHp * healRatio),
    );

    const nextHp = Math.min(input.state.maxHp, input.state.hp + healAmount);

    return {
      state: {
        ...input.state,
        hp: nextHp,
      },
      delta: {
        type: 'REST',
        detail: {
          stats: {
            hp: nextHp - input.state.hp,
          },
        },
      },
    };
  }
}
