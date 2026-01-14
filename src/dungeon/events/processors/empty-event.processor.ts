import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
} from '../event.types';

export class EmptyEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.EMPTY;

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    return {
      state: { ...input.state },
      delta: {
        type: 'EMPTY',
        detail: {},
      },
    };
  }
}
