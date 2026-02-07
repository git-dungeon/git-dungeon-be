import type { ErrorObject } from 'ajv';

export type AjvIssue = {
  instancePath: string;
  keyword: string;
  message?: string;
  params?: unknown;
};

export const formatAjvIssues = (
  errors: ErrorObject[] | null | undefined,
): AjvIssue[] => {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message,
    params: error.params,
  }));
};
