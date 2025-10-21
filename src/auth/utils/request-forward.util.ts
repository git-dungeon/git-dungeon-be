import type { Request } from 'express';

const resolveRequestOrigin = (request: Request): string | undefined => {
  const forwardedHost =
    request.get('x-forwarded-host') ?? request.get('x-original-host');
  const host = forwardedHost ?? request.get('host');
  if (!host) {
    return undefined;
  }

  const protoHeader = request.get('x-forwarded-proto');
  const protocol = protoHeader ?? (request.secure ? 'https' : 'http');

  const hostname = host.split(',')[0]?.trim();
  if (!hostname) {
    return undefined;
  }

  return `${protocol}://${hostname}`;
};

/**
 * Express Request에서 better-auth API로 전달할 헤더 객체를 생성한다.
 * - 사용자 식별에 필요한 기본 헤더를 그대로 전달한다.
 * - 프록시 환경을 고려해 `x-forwarded-*` 계열 헤더도 복사한다.
 */
export const buildForwardHeaders = (request: Request): globalThis.Headers => {
  const headers = new globalThis.Headers();

  const copy = (name: string) => {
    const value = request.get(name);
    if (value) {
      headers.set(name, value);
    }
  };

  copy('user-agent');
  copy('accept-language');
  copy('x-forwarded-for');
  copy('x-request-id');
  copy('cookie');

  // Host 헤더는 대상 URL을 기반으로 undici(fetch)가 자동 설정한다.
  // 직접 설정하면 `TypeError: forbidden header name`가 발생하므로 제외한다.

  const forwardedHost = request.get('x-forwarded-host');
  if (forwardedHost) {
    headers.set('x-forwarded-host', forwardedHost);
  }

  const forwardedProto =
    request.get('x-forwarded-proto') ?? (request.secure ? 'https' : 'http');
  headers.set('x-forwarded-proto', forwardedProto);

  const origin = request.get('origin') ?? resolveRequestOrigin(request);
  if (origin) {
    headers.set('origin', origin);
    headers.set('referer', origin);
  } else {
    const referer = request.get('referer');
    if (referer) {
      headers.set('referer', referer);
    }
  }

  return headers;
};
