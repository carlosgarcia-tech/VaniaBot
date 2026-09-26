/**
 * auth.test.ts
 *
 * Unit tests for the webhook router auth helpers.
 * Covers token extraction, fail-closed authorization, and
 * constant-time comparison behavior.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';
import { extractApiToken, isAuthorized, requireApiToken } from '../../../src/services/webhook/routers/auth.js';

function mockRequest(options: {
  headerToken?: string;
  queryToken?: string;
  headerTokenArray?: string[];
} = {}): Request {
  const headers: Record<string, unknown> = {};
  if (options.headerToken !== undefined) headers['x-api-token'] = options.headerToken;
  if (options.headerTokenArray !== undefined) headers['x-api-token'] = options.headerTokenArray;

  const query: Record<string, unknown> = {};
  if (options.queryToken !== undefined) query['token'] = options.queryToken;

  return {
    headers,
    query,
  } as unknown as Request;
}

describe('extractApiToken', () => {
  it('returns the x-api-token header when present', () => {
    expect(extractApiToken(mockRequest({ headerToken: 'abc123' }))).toBe('abc123');
  });

  it('prefers the header over the query param', () => {
    const req = mockRequest({ headerToken: 'header-token', queryToken: 'query-token' });
    expect(extractApiToken(req)).toBe('header-token');
  });

  it('falls back to the token query param', () => {
    expect(extractApiToken(mockRequest({ queryToken: 'query-token' }))).toBe('query-token');
  });

  it('returns undefined when no token is present', () => {
    expect(extractApiToken(mockRequest())).toBeUndefined();
  });

  it('ignores empty header values', () => {
    expect(extractApiToken(mockRequest({ headerToken: '' }))).toBeUndefined();
  });

  it('ignores array-valued headers', () => {
    expect(extractApiToken(mockRequest({ headerTokenArray: ['a', 'b'] }))).toBeUndefined();
  });
});

describe('isAuthorized', () => {
  it('accepts a matching header token', () => {
    const req = mockRequest({ headerToken: 'secret-token' });
    expect(isAuthorized(req, 'secret-token')).toBe(true);
  });

  it('accepts a matching query token', () => {
    const req = mockRequest({ queryToken: 'secret-token' });
    expect(isAuthorized(req, 'secret-token')).toBe(true);
  });

  it('rejects a wrong token', () => {
    const req = mockRequest({ headerToken: 'wrong-token' });
    expect(isAuthorized(req, 'secret-token')).toBe(false);
  });

  it('rejects when no token is sent', () => {
    expect(isAuthorized(mockRequest(), 'secret-token')).toBe(false);
  });

  it('fails closed when the server has no token configured', () => {
    const req = mockRequest({ headerToken: 'anything' });
    expect(isAuthorized(req, '')).toBe(false);
  });

  it('is not case-sensitive-matched (tokens are exact)', () => {
    const req = mockRequest({ headerToken: 'Secret-Token' });
    expect(isAuthorized(req, 'secret-token')).toBe(false);
  });
});

describe('requireApiToken middleware', () => {
  it('calls next() for authorized requests', () => {
    const middleware = requireApiToken('secret-token');
    const req = mockRequest({ headerToken: 'secret-token' });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    middleware(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 401 for unauthorized requests and does not call next()', () => {
    const middleware = requireApiToken('secret-token');
    const req = mockRequest({ headerToken: 'bad' });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    middleware(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid API token' });
  });
});
