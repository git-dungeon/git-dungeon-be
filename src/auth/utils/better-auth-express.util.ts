import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

type BetterAuthHandler = (request: Request) => Promise<Response>;

const SUPPORTED_METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFetchRequest = (req: ExpressRequest): Request => {
  const hostHeader = req.get('host');
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol =
    forwardedProto?.split(',')[0]?.trim() ??
    (req.secure ? 'https' : (req.protocol ?? 'http'));
  const url = new URL(
    req.originalUrl || req.url,
    `${protocol}://${hostHeader ?? 'localhost'}`,
  );

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'undefined') {
      continue;
    }
    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method?.toUpperCase() ?? 'GET';
  const requestInit: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
  };

  if (SUPPORTED_METHODS_WITHOUT_BODY.has(method)) {
    return new Request(url, requestInit);
  }

  let body: BodyInit | null | undefined;
  if (Buffer.isBuffer(req.body)) {
    body = new Uint8Array(req.body);
  } else if (typeof req.body === 'string') {
    body = req.body;
  } else if (
    req.body === undefined ||
    req.body === null ||
    (isPlainObject(req.body) && Object.keys(req.body).length === 0)
  ) {
    body = null;
  } else if (
    headers
      .get('content-type')
      ?.includes('application/x-www-form-urlencoded') &&
    isPlainObject(req.body)
  ) {
    const entries = Object.entries(req.body).map<[string, string]>(
      ([key, value]) => {
        if (typeof value === 'string') {
          return [key, value];
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          return [key, String(value)];
        }
        return [key, ''];
      },
    );
    body = new URLSearchParams(entries);
  } else {
    body = JSON.stringify(req.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  if (typeof body !== 'undefined' && body !== null) {
    requestInit.body = body;
    requestInit.duplex = 'half';
  }

  return new Request(url, requestInit);
};

const applyResponseHeaders = (res: ExpressResponse, response: Response) => {
  const setCookieValues =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : undefined;
  if (Array.isArray(setCookieValues) && setCookieValues.length > 0) {
    res.setHeader('Set-Cookie', setCookieValues);
  } else {
    const singleCookie = response.headers.get('set-cookie');
    if (singleCookie) {
      res.setHeader('Set-Cookie', singleCookie);
    }
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }
    res.setHeader(key, value);
  });
};

const sendExpressResponse = async (
  res: ExpressResponse,
  response: Response,
) => {
  res.status(response.status);
  applyResponseHeaders(res, response);

  if (response.status === 204 || response.body === null) {
    res.end();
    return;
  }

  const arrayBuffer = await response.arrayBuffer().catch(() => undefined);
  if (typeof arrayBuffer === 'undefined') {
    res.end();
    return;
  }

  if (arrayBuffer.byteLength === 0) {
    res.end();
    return;
  }

  res.end(Buffer.from(arrayBuffer));
};

export const createBetterAuthExpressMiddleware =
  (handler: BetterAuthHandler) =>
  async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    try {
      const request = toFetchRequest(req);
      const response = await handler(request);

      if (response.status === 404) {
        await response.body?.cancel?.().catch(() => undefined);
        next();
        return;
      }

      await sendExpressResponse(res, response);
    } catch (error) {
      next(error);
    }
  };
