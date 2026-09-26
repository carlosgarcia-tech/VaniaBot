/**
 * VaniaToggleMiddleware.test.ts
 *
 * Unit tests for the VaniaToggleMiddleware class.
 * Tests the toggle bypass security fix (vaniaon, vaniaoff, vaniastatus)
 * and the delegation to the shared VaniaToggleService guard.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VaniaToggleMiddleware } from '../../src/middlewares/VaniaToggleMiddleware.js';
import { middlewareCache } from '../../src/middlewares/MiddlewareCache.js';
import type { MessageContext } from '../../src/types/index.js';

const mockIsAllowedForSubbot = vi.fn();

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    vaniaToggleService: {
      isAllowedForSubbot: (...args: unknown[]) => mockIsAllowedForSubbot(...args),
    },
  },
}));

describe('VaniaToggleMiddleware', () => {
  let middleware: VaniaToggleMiddleware;
  let mockNext: ReturnType<typeof vi.fn>;
  let mockCtx: MessageContext;

  const createGroupCtx = (command: string): MessageContext =>
    ({
      command,
      args: [],
      botId: 'main',
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'group@test.g.us', isGroup: true, isBotAdmin: false },
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false },
      reply: vi.fn(),
      react: vi.fn(),
      text: '',
    }) as unknown as MessageContext;

  const createPrivateCtx = (command: string): MessageContext =>
    ({
      command,
      args: [],
      botId: 'main',
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'user@s.whatsapp.net', isGroup: false, isBotAdmin: false },
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false },
      reply: vi.fn(),
      react: vi.fn(),
      text: '',
    }) as unknown as MessageContext;

  beforeEach(() => {
    middleware = new VaniaToggleMiddleware();
    mockNext = vi.fn().mockResolvedValue(undefined);
    mockIsAllowedForSubbot.mockResolvedValue(true);
  });

  afterEach(() => {
    middlewareCache.clear();
  });

  describe('private chat', () => {
    it('should always allow commands in private chat', async () => {
      mockCtx = createPrivateCtx('test');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should always allow toggle commands in private chat', async () => {
      for (const cmd of ['vaniaon', 'vaniaoff', 'vaniastatus']) {
        mockCtx = createPrivateCtx(cmd);
        mockNext = vi.fn().mockResolvedValue(undefined);
        await middleware.execute(mockCtx, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('group chat - toggle command bypass', () => {
    it('should bypass toggle for vaniaon command', async () => {
      mockCtx = createGroupCtx('vaniaon');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });

    it('should bypass toggle for vaniaoff command', async () => {
      mockCtx = createGroupCtx('vaniaoff');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });

    it('should bypass toggle for vaniastatus command', async () => {
      mockCtx = createGroupCtx('vaniastatus');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });
  });

  describe('group chat - non-toggle commands', () => {
    it('should delegate the guard to the shared service for non-toggle commands', async () => {
      mockCtx = createGroupCtx('help');
      await middleware.execute(mockCtx, mockNext);
      expect(mockIsAllowedForSubbot).toHaveBeenCalledWith('group@test.g.us', 'main', 'help');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block non-toggle commands when the guard denies', async () => {
      middlewareCache.groupEnabled.clear();
      mockIsAllowedForSubbot.mockResolvedValue(false);
      mockCtx = createGroupCtx('help');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow non-toggle commands when the guard allows', async () => {
      middlewareCache.groupEnabled.clear();
      mockIsAllowedForSubbot.mockResolvedValue(true);
      mockCtx = createGroupCtx('ping');
      await middleware.execute(mockCtx, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
