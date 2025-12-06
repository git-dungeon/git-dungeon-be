import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
  MAX_FLOOR_PROGRESS,
} from '../event.types';

export class MoveEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.MOVE;

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const nextFloor = input.state.floor + 1;
    const nextMaxFloor = Math.max(input.state.maxFloor, nextFloor);

    return {
      state: {
        ...input.state,
        floor: nextFloor,
        maxFloor: nextMaxFloor,
        floorProgress: 0,
        currentActionStartedAt: input.state.currentActionStartedAt,
      },
      delta: {
        type: 'MOVE',
        detail: {
          fromFloor: input.state.floor,
          toFloor: nextFloor,
          previousProgress: input.state.floorProgress,
          cappedProgress: Math.min(
            input.state.floorProgress,
            MAX_FLOOR_PROGRESS,
          ),
        },
      },
    };
  }
}
