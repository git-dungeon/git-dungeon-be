const INTERNAL_PATH_PATTERN = /^\/(?!\/)/;
const PROTOCOL_PATTERN = /:\/\//;
const WHITESPACE_PATTERN = /\s/;

export const DEFAULT_REDIRECT_PATH = '/dashboard';

export class InvalidRedirectError extends Error {
  constructor(message = 'Invalid redirect') {
    super(message);
    this.name = 'InvalidRedirectError';
  }
}

const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isSafePath = (candidate: string): boolean => {
  if (!candidate) {
    return false;
  }

  if (!INTERNAL_PATH_PATTERN.test(candidate)) {
    return false;
  }

  if (candidate.startsWith('//')) {
    return false;
  }

  if (PROTOCOL_PATTERN.test(candidate)) {
    return false;
  }

  if (WHITESPACE_PATTERN.test(candidate)) {
    return false;
  }

  return true;
};

export interface RedirectValidationResult {
  value: string;
  provided: boolean;
}

export const validateRedirectParam = (
  input: string | undefined,
  fallback: string = DEFAULT_REDIRECT_PATH,
): RedirectValidationResult => {
  const safeFallback = isSafePath(fallback) ? fallback : DEFAULT_REDIRECT_PATH;

  if (typeof input === 'undefined' || input === null || input.length === 0) {
    return { value: safeFallback, provided: false };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { value: safeFallback, provided: false };
  }

  const decoded = decodeSafe(trimmed);
  if (!isSafePath(decoded)) {
    throw new InvalidRedirectError();
  }

  return { value: decoded, provided: true };
};
