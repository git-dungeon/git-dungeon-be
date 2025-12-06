import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
} from '../event.types';

export class BattleEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.BATTLE;

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    // TODO:전투 해석/드랍 계산은 M3-2/M3-3에서 교체 예정. 현재는 상태를 변경하지 않는다.
    return {
      state: {
        ...input.state,
      },
      delta: {
        type: 'BATTLE',
        detail: {},
      },
    };
  }
}
