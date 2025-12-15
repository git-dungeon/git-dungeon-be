import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value);
const generateRequestId = () => randomUUID();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const incomingId = req.header(REQUEST_ID_HEADER);
    const requestId = isUuid(incomingId) ? incomingId : generateRequestId();

    req.id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
