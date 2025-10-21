type FetchHeaders = globalThis.Headers;

interface HeadersWithRaw extends FetchHeaders {
  raw(): Record<string, string[]>;
}

const hasRaw = (headers: FetchHeaders): headers is HeadersWithRaw =>
  typeof (headers as { raw?: unknown }).raw === 'function';

/**
 * better-auth 응답 헤더에서 모든 `Set-Cookie` 값을 추출한다.
 * Fetch API의 `getSetCookie` 지원 여부에 따라 fall-back을 제공한다.
 */
export const collectSetCookies = (headers?: FetchHeaders): string[] => {
  if (!headers) {
    return [];
  }

  try {
    const setCookieValues = headers.getSetCookie?.();
    if (Array.isArray(setCookieValues) && setCookieValues.length > 0) {
      return setCookieValues;
    }
  } catch {
    // 일부 런타임에서는 getSetCookie가 구현되지 않으므로 무시한다.
  }

  if (hasRaw(headers)) {
    const raw = headers.raw();
    const values = raw['set-cookie'];
    if (Array.isArray(values)) {
      return values;
    }
  }

  const single = headers.get('set-cookie');
  return typeof single === 'string' ? [single] : [];
};
