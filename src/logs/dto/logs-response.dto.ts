import type { ApiSuccessResponse } from '../../common/http/api-response';
import type { DungeonLogDelta } from '../../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../../common/logs/dungeon-log-extra';
import {
  type LogAction,
  type LogCategory,
  type LogStatus,
} from '../logs.types';

export interface DungeonLogEntryDto {
  id: string;
  category: LogCategory;
  action: LogAction;
  status: LogStatus;
  floor: number | null;
  turnNumber: number | null;
  stateVersionBefore: number | null;
  stateVersionAfter: number | null;
  delta: DungeonLogDelta | null;
  extra: DungeonLogDetails | null;
  createdAt: string;
}

export interface DungeonLogsPayload {
  logs: DungeonLogEntryDto[];
  nextCursor: string | null;
}

export type LogsResponseMeta = {
  requestId: string;
  generatedAt: string;
};

export type DungeonLogsResponse = ApiSuccessResponse<DungeonLogsPayload> & {
  meta: LogsResponseMeta;
};
