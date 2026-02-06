import { resolve } from 'node:path';

export const OPENAPI_VALIDATION_MODES = ['off', 'report', 'enforce'] as const;
export type OpenApiValidationMode = (typeof OPENAPI_VALIDATION_MODES)[number];

const DEFAULT_OPENAPI_VALIDATION_MODE: OpenApiValidationMode = 'enforce';
const OPENAPI_VALIDATION_MODE_SET = new Set<string>(OPENAPI_VALIDATION_MODES);

export const resolveOpenApiSpecPath = (): string => {
  const explicit = process.env.OPENAPI_SPEC_PATH?.trim();
  if (explicit) {
    return explicit;
  }

  // Default for the local "git-dungeon" workspace where `docs/` sits next to `git-dungeon-be/`.
  return resolve(
    process.cwd(),
    '..',
    'docs',
    'api-spec',
    'spec',
    'openapi.yaml',
  );
};

export const resolveOpenApiValidationMode = (): OpenApiValidationMode => {
  const raw = process.env.OPENAPI_VALIDATION_MODE?.trim().toLowerCase();
  if (raw && OPENAPI_VALIDATION_MODE_SET.has(raw)) {
    return raw as OpenApiValidationMode;
  }
  return DEFAULT_OPENAPI_VALIDATION_MODE;
};

export const DEFAULT_OPENAPI_VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
