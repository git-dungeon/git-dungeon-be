export interface ApiResponseMeta {
  requestId?: string;
  generatedAt?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  meta: ApiResponseMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const successResponse = <T>(
  data: T,
  meta: ApiResponseMeta,
): ApiSuccessResponse<T> => ({
  success: true,
  data,
  meta,
});

export const successResponseWithGeneratedAt = <T>(
  data: T,
  meta: ApiResponseMeta = {},
): ApiSuccessResponse<T> => {
  if (!meta.requestId) {
    throw new Error(
      'successResponseWithGeneratedAt requires `meta.requestId`. Please pass the current request id explicitly.',
    );
  }

  return successResponse(data, {
    ...meta,
    generatedAt: new Date().toISOString(),
  });
};

export const errorResponse = (
  error: ApiErrorBody,
  meta: ApiResponseMeta,
): ApiErrorResponse => ({
  success: false,
  error,
  meta,
});
