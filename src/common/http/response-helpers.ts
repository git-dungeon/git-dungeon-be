import type { Response } from 'express';

export const applyNoCacheHeaders = (response: Response): void => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
};

export const appendCookies = (response: Response, cookies: string[]): void => {
  for (const cookie of cookies) {
    response.append('Set-Cookie', cookie);
  }
};
