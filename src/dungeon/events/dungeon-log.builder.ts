import { Injectable } from '@nestjs/common';
import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
  type DungeonState,
} from '@prisma/client';
import type {
  DungeonEventLogStub,
  DungeonEventType,
  DungeonLogPayload,
} from './event.types';

const actionMapping: Record<DungeonEventType, DungeonLogAction> = {
  BATTLE: DungeonLogAction.BATTLE,
  TREASURE: DungeonLogAction.TREASURE,
  REST: DungeonLogAction.REST,
  TRAP: DungeonLogAction.TRAP,
  MOVE: DungeonLogAction.MOVE,
};

type BuildParams = {
  stateBefore: DungeonState;
  stateAfter: DungeonState;
  logs: DungeonEventLogStub[];
  turnNumber?: number;
};

@Injectable()
export class DungeonLogBuilder {
  buildExplorationLogs(params: BuildParams): DungeonLogPayload[] {
    const { stateBefore, stateAfter, logs, turnNumber } = params;

    return logs.map((log) => ({
      category: DungeonLogCategory.EXPLORATION,
      action: log.actionOverride ?? actionMapping[log.type],
      status:
        log.status === 'STARTED'
          ? DungeonLogStatus.STARTED
          : DungeonLogStatus.COMPLETED,
      floor: log.status === 'STARTED' ? stateBefore.floor : stateAfter.floor,
      turnNumber,
      stateVersionBefore: stateBefore.version,
      stateVersionAfter:
        log.status === 'COMPLETED' ? stateAfter.version : undefined,
      delta: log.delta,
      extra: log.extra,
      createdAt: new Date(),
    }));
  }
}
