import { tags } from 'typia';
import type { ApiSuccessResponse } from '../../common/http/api-response';
import type { DungeonLogDelta } from '../../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../../common/logs/dungeon-log-extra';
import {
  type LogAction,
  type LogCategory,
  type LogStatus,
} from '../logs.types';

export interface DungeonLogEntryDto {
  id: string & tags.Format<'uuid'>;
  category: LogCategory;
  action: LogAction;
  status: LogStatus;
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

export type LogsResponseMeta = {
  requestId: string & tags.Format<'uuid'>;
  generatedAt: string & tags.Format<'date-time'>;
};

export type DungeonLogsResponse = ApiSuccessResponse<DungeonLogsPayload> & {
  meta: LogsResponseMeta;
};
