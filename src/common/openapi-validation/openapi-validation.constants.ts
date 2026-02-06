export const resolveOpenApiSpecPath = (): string => {
  const explicit = process.env.OPENAPI_SPEC_PATH?.trim();
  if (explicit) {
    return explicit;
  }

  // Default for the local "git-dungeon" workspace where `docs/` sits next to `git-dungeon-be/`.
  return `${process.cwd()}/../docs/api-spec/spec/openapi.yaml`;
};

export const DEFAULT_OPENAPI_VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
