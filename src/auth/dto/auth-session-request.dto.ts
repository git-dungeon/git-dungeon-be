import type { Request } from 'express';
import type { ActiveSessionResult } from '../auth-session.service';

declare module 'express' {
  interface Request {
    authSession?: ActiveSessionResult;
  }
}

export type AuthenticatedRequest = Request & {
  authSession: ActiveSessionResult;
};
