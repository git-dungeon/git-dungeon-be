import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const generateRequestId = () => randomBytes(16).toString('hex');

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const incomingId = req.header(REQUEST_ID_HEADER);
    const requestId =
      incomingId && incomingId.length > 0 ? incomingId : generateRequestId();

    req.id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
