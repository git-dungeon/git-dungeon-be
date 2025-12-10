import {
  DungeonLogAction,
  DungeonLogCategory,
  DungeonLogStatus,
} from '@prisma/client';
import { tags } from 'typia';
import type { ApiSuccessResponse } from '../../common/http/api-response';
import type { DungeonLogDelta } from '../../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../../common/logs/dungeon-log-extra';

export interface DungeonLogEntryDto {
  id: string & tags.Format<'uuid'>;
  category: DungeonLogCategory;
  action: DungeonLogAction;
  status: DungeonLogStatus;
  floor: (number & tags.Minimum<1>) | null;
  turnNumber: (number & tags.Minimum<0>) | null;
  stateVersionBefore: (number & tags.Minimum<0>) | null;
  stateVersionAfter: (number & tags.Minimum<0>) | null;
  delta: DungeonLogDelta | null;
  extra: DungeonLogDetails | null;
  createdAt: string & tags.Format<'date-time'>;
}

export interface DungeonLogsPayload {
  logs: DungeonLogEntryDto[];
  nextCursor: (string & tags.MinLength<1>) | null;
}

export type DungeonLogsResponse = ApiSuccessResponse<DungeonLogsPayload> & {
  meta: {
    requestId: string & tags.Format<'uuid'>;
    generatedAt: string & tags.Format<'date-time'>;
  };
};
