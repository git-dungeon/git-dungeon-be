import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const incomingId = req.header(REQUEST_ID_HEADER);
    const requestId =
      incomingId && incomingId.length > 0 ? incomingId : nanoid();

    req.id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
