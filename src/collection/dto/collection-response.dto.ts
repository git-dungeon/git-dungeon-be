import type { ApiSuccessResponse } from '../../common/http/api-response';

export interface CollectionProgress {
  discovered: number;
  total: number;
  percent: number;
}

export interface CollectionSummary {
  items: CollectionProgress;
  monsters: CollectionProgress;
  overall: CollectionProgress;
}

export interface CollectionCodeList {
  discoveredCodes: string[];
}

export interface CollectionResponse {
  summary: CollectionSummary;
  items: CollectionCodeList;
  monsters: CollectionCodeList;
}

export type CollectionResponseMeta = {
  requestId: string;
  generatedAt: string;
};

export type CollectionApiResponse = ApiSuccessResponse<CollectionResponse> & {
  meta: CollectionResponseMeta;
};
