import type { Request } from 'express';
import type { ActiveSessionResult } from './auth-session.service.js';

declare module 'express' {
  interface Request {
    authSession?: ActiveSessionResult;
  }
}

export type AuthenticatedRequest = Request & {
  authSession: ActiveSessionResult;
};
