/**
 * `GET /api/ranking` 쿼리 파라미터 DTO.
 * 런타임 제약 검증은 OpenAPI/Ajv 및 `validateRankingQuery`에서 처리한다.
 */
export interface RankingQueryDto {
  limit?: number;
  cursor?: string;
}
