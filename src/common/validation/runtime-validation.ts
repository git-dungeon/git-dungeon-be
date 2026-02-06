export class RuntimeValidationError extends Error {
  constructor(
    public readonly path: string,
    public readonly expected: string,
    public readonly value: unknown,
  ) {
    super(`Validation failed at ${path}: expected ${expected}`);
    this.name = 'RuntimeValidationError';
  }
}

const fail = (path: string, expected: string, value: unknown): never => {
  throw new RuntimeValidationError(path, expected, value);
};

export const assertRecord = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'object', value);
  }
  return value as Record<string, unknown>;
};

export const assertArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    fail(path, 'array', value);
  }
  return value as unknown[];
};

export const assertString = (
  value: unknown,
  path: string,
  options?: { minLength?: number },
): string => {
  if (typeof value !== 'string') {
    fail(path, 'string', value);
  }
  const text = value as string;
  if (options?.minLength !== undefined && text.length < options.minLength) {
    fail(path, `string(length>=${options.minLength})`, text);
  }
  return text;
};

export const assertNullableString = (
  value: unknown,
  path: string,
): string | null => {
  if (value === null) {
    return null;
  }
  return assertString(value, path);
};

export const assertBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') {
    fail(path, 'boolean', value);
  }
  return value as boolean;
};

export const assertNumber = (
  value: unknown,
  path: string,
  options?: { integer?: boolean; min?: number; max?: number },
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'number', value);
  }
  const num = value as number;
  if (options?.integer && !Number.isInteger(num)) {
    fail(path, 'integer', num);
  }
  if (options?.min !== undefined && num < options.min) {
    fail(path, `number(>=${options.min})`, num);
  }
  if (options?.max !== undefined && num > options.max) {
    fail(path, `number(<=${options.max})`, num);
  }
  return num;
};

export const assertNullableNumber = (
  value: unknown,
  path: string,
  options?: { integer?: boolean; min?: number; max?: number },
): number | null => {
  if (value === null) {
    return null;
  }
  return assertNumber(value, path, options);
};

export const assertIsoDateTimeString = (
  value: unknown,
  path: string,
): string => {
  const text = assertString(value, path, { minLength: 1 });
  if (Number.isNaN(Date.parse(text))) {
    fail(path, 'ISO date-time string', value);
  }
  return text;
};

export const assertNullableIsoDateTimeString = (
  value: unknown,
  path: string,
): string | null => {
  if (value === null) {
    return null;
  }
  return assertIsoDateTimeString(value, path);
};

export const assertOneOf = <T extends string>(
  value: unknown,
  path: string,
  candidates: readonly T[],
): T => {
  const text = assertString(value, path, { minLength: 1 });
  if (!candidates.includes(text as T)) {
    fail(path, `one of [${candidates.join(', ')}]`, value);
  }
  return text as T;
};
