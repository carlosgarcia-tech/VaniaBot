/**
 * Middleware.test.ts
 *
 * Unit tests for Middleware classes.
 * Tests base middleware functionality.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Middleware } from '../../src/middlewares/Middleware.js';
import type { MessageContext } from '../../src/types/index.js';

class TestMiddleware extends Middleware {
  name = 'test';
  executeCalled = false;

  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    this.executeCalled = true;
    await next();
  }
}

describe('Middleware', () => {
  let middleware: TestMiddleware;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockCtx: MessageContext;

  beforeEach(() => {
    middleware = new TestMiddleware();
    mockNext = vi.fn().mockResolvedValue(undefined);
    mockCtx = {
      command: 'test',
      args: [],
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'group@test.com', isGroup: true, isBotAdmin: false } as any,
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false } as any,
      reply: vi.fn().mockResolvedValue(undefined),
      react: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessageContext;
  });

  it('should have a name', () => {
    expect(middleware.name).toBe('test');
  });

  it('should execute and call next', async () => {
    await middleware.execute(mockCtx, mockNext as () => Promise<void>);

    expect(middleware.executeCalled).toBe(true);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next even if it throws', async () => {
    mockNext.mockRejectedValueOnce(new Error('Next error'));

    await expect(middleware.execute(mockCtx, mockNext as () => Promise<void>)).rejects.toThrow(
      'Next error',
    );
  });
});
