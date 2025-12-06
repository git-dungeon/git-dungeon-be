import {
  DEFAULT_EVENT_WEIGHTS,
  DungeonEventSelectionInput,
  DungeonEventSelector,
  DungeonEventType,
  MAX_FLOOR_PROGRESS,
} from './event.types';

export class WeightedDungeonEventSelector implements DungeonEventSelector {
  select(input: DungeonEventSelectionInput): DungeonEventType {
    if (input.state.floorProgress >= MAX_FLOOR_PROGRESS) {
      return DungeonEventType.MOVE;
    }

    const weights = input.weights ?? DEFAULT_EVENT_WEIGHTS;
    const total =
      weights[DungeonEventType.BATTLE] +
      weights[DungeonEventType.TREASURE] +
      weights[DungeonEventType.REST] +
      weights[DungeonEventType.TRAP];

    if (total <= 0) {
      return DungeonEventType.BATTLE;
    }

    const pick = input.rngValue * total;

    if (pick < weights[DungeonEventType.BATTLE]) {
      return DungeonEventType.BATTLE;
    }

    if (
      pick <
      weights[DungeonEventType.BATTLE] + weights[DungeonEventType.TREASURE]
    ) {
      return DungeonEventType.TREASURE;
    }

    if (
      pick <
      weights[DungeonEventType.BATTLE] +
        weights[DungeonEventType.TREASURE] +
        weights[DungeonEventType.REST]
    ) {
      return DungeonEventType.REST;
    }

    return DungeonEventType.TRAP;
  }
}
