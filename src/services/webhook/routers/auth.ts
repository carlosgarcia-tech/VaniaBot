import { timingSafeEqual, createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Constant-time string comparison. Both inputs are hashed first so the
 * comparison length is fixed and never leaks token length or prefix matches.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = createHash('sha256').update(a).digest();
  const bBuf = createHash('sha256').update(b).digest();
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Extracts the API token from a request. Accepts the `x-api-token` header
 * (preferred) or a `?token=` query parameter (handy for quick manual checks).
 */
export function extractApiToken(req: Request): string | undefined {
  const header = req.headers['x-api-token'];
  if (typeof header === 'string' && header.length > 0) return header;
  const query = req.query['token'];
  if (typeof query === 'string' && query.length > 0) return query;
  return undefined;
}

/**
 * True when the request carries the expected token. Fails closed: if no
 * token is configured on the server, every request is rejected.
 */
export function isAuthorized(req: Request, webhookToken: string): boolean {
  if (!webhookToken) return false;
  const token = extractApiToken(req);
  if (!token) return false;
  return safeEqual(token, webhookToken);
}

/**
 * Express middleware factory that guards a router with the API token.
 */
export function requireApiToken(
  webhookToken: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!isAuthorized(req, webhookToken)) {
      res.status(401).json({ success: false, message: 'Invalid API token' });
      return;
    }
    next();
  };
}
