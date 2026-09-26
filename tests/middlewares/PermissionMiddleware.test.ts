/**
 * PermissionMiddleware.test.ts
 *
 * Unit tests for the PermissionMiddleware class.
 * Tests user permission levels (OWNER/ADMIN/USER), bot permission checks,
 * admin-only mode and the @lid owner override resolution.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PermissionMiddleware } from '../../src/middlewares/PermissionMiddleware.js';
import { middlewareCache } from '../../src/middlewares/MiddlewareCache.js';
import { CommandCategory, PermissionLevel, BotPermission } from '../../src/types/index.js';
import type { ICommand, MessageContext } from '../../src/types/index.js';

// --- Mocks -----------------------------------------------------------------

const mockGetOnlyAdmin = vi.fn();
const mockGetUser = vi.fn();
const mockIsOwnerAsync = vi.fn();

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    groupService: {
      getOnlyAdmin: (...args: unknown[]) => mockGetOnlyAdmin(...args),
    },
    userService: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

vi.mock('../../src/services/PermissionService.js', () => ({
  PermissionService: {
    isOwnerAsync: (...args: unknown[]) => mockIsOwnerAsync(...args),
  },
}));

// --- Helpers ---------------------------------------------------------------

const USER_JID = 'user@s.whatsapp.net';
const OWNER_LID = '208924405956643@lid';
const GROUP_JID = 'group@test.g.us';

const createCommand = (permissions?: ICommand['permissions']): ICommand => ({
  name: 'protected',
  description: 'protected command',
  category: CommandCategory.UTILITY,
  permissions,
  execute: async () => {},
});

interface CtxOptions {
  command?: string;
  isGroup?: boolean;
  isOwner?: boolean;
  isAdmin?: boolean;
  isBotAdmin?: boolean;
  jid?: string;
}

const createCtx = (options: CtxOptions = {}): MessageContext => {
  const {
    command = 'protected',
    isGroup = true,
    isOwner = false,
    isAdmin = false,
    isBotAdmin = false,
    jid = USER_JID,
  } = options;

  const ctx = {
    command,
    args: [],
    botId: 'main',
    message: { key: { remoteJid: isGroup ? GROUP_JID : `${USER_JID}.chat` } },
    sock: {} as never,
    chat: { jid: isGroup ? GROUP_JID : USER_JID, isGroup, isBotAdmin },
    sender: { jid, isOwner, isAdmin },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    loadSenderPermissions: vi.fn().mockResolvedValue(undefined),
    loadBotPermissions: vi.fn().mockResolvedValue(undefined),
    setOwnerOverride: vi.fn(),
    text: '',
  };

  return ctx as unknown as MessageContext;
};

// --- Tests -----------------------------------------------------------------

describe('PermissionMiddleware', () => {
  let middleware: PermissionMiddleware;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    middleware = new PermissionMiddleware({
      get: vi.fn(),
    } as never);
    mockNext = vi.fn().mockResolvedValue(undefined);

    // Sensible defaults: no admin-only mode, sender is a plain user.
    mockGetOnlyAdmin.mockResolvedValue(false);
    mockGetUser.mockResolvedValue({ isOwner: false });
    mockIsOwnerAsync.mockResolvedValue(false);
  });

  afterEach(() => {
    middlewareCache.clear();
  });

  describe('non-command messages', () => {
    it('should call next without any permission checks when no command is resolved', async () => {
      const ctx = createCtx({ command: '' });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockGetOnlyAdmin).not.toHaveBeenCalled();
      expect(ctx.loadSenderPermissions).not.toHaveBeenCalled();
    });

    it('should call next when the command is not in the registry', async () => {
      // Registry with no matching command.
      middleware = new PermissionMiddleware({
        get: vi.fn().mockReturnValue(undefined),
      } as never);
      const ctx = createCtx();

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('private chat', () => {
    it('should skip group-only checks (bot perms, onlyAdmin) in private chats', async () => {
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isGroup: false });

      await middleware.execute(ctx, mockNext);

      expect(ctx.loadBotPermissions).not.toHaveBeenCalled();
      expect(mockGetOnlyAdmin).not.toHaveBeenCalled();
      expect(ctx.loadSenderPermissions).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('group chat - setup side effects', () => {
    it('should load bot and sender permissions for group commands', async () => {
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx();

      await middleware.execute(ctx, mockNext);

      expect(ctx.loadBotPermissions).toHaveBeenCalled();
      expect(ctx.loadSenderPermissions).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should resolve and set the owner override for @lid senders', async () => {
      mockIsOwnerAsync.mockResolvedValue(true);
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ jid: OWNER_LID });

      await middleware.execute(ctx, mockNext);

      expect(mockIsOwnerAsync).toHaveBeenCalledWith(ctx.sock, OWNER_LID);
      expect(ctx.setOwnerOverride).toHaveBeenCalledWith(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set the owner override when the @lid sender is not an owner', async () => {
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ jid: OWNER_LID });

      await middleware.execute(ctx, mockNext);

      expect(ctx.setOwnerOverride).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should consult getOnlyAdmin and cache the value per group', async () => {
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);

      const first = createCtx();
      await middleware.execute(first, mockNext);
      // Second execution for the same group must hit the cache.
      const second = createCtx();
      await middleware.execute(second, mockNext);

      expect(mockGetOnlyAdmin).toHaveBeenCalledTimes(1);
      expect(mockGetOnlyAdmin).toHaveBeenCalledWith(GROUP_JID);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('admin-only mode', () => {
    it('should block non-admin non-owner users with a ❌ react', async () => {
      mockGetOnlyAdmin.mockResolvedValue(true);
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isOwner: false, isAdmin: false });

      await middleware.execute(ctx, mockNext);

      expect(ctx.react).toHaveBeenCalledWith('❌');
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow admins when admin-only mode is on', async () => {
      mockGetOnlyAdmin.mockResolvedValue(true);
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isAdmin: true });

      await middleware.execute(ctx, mockNext);

      expect(ctx.react).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow owners when admin-only mode is on', async () => {
      mockGetOnlyAdmin.mockResolvedValue(true);
      const registryGet = vi.fn().mockReturnValue(createCommand());
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isOwner: true });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('user permissions', () => {
    it('should always allow owners regardless of required level', async () => {
      const cmd = createCommand({ user: [PermissionLevel.OWNER] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isOwner: true });

      await middleware.execute(ctx, mockNext);

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-owners for OWNER-level commands after a DB lookup', async () => {
      const cmd = createCommand({ user: [PermissionLevel.OWNER] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      mockGetUser.mockResolvedValue({ isOwner: false });
      const ctx = createCtx({ isOwner: false });

      await middleware.execute(ctx, mockNext);

      expect(mockGetUser).toHaveBeenCalledWith(USER_JID);
      expect(ctx.reply).toHaveBeenCalledWith('❌ No tienes permiso para usar este comando');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow non-owners whose DB record flags them as owner', async () => {
      const cmd = createCommand({ user: [PermissionLevel.OWNER] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      mockGetUser.mockResolvedValue({ isOwner: true });
      const ctx = createCtx({ isOwner: false });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('should allow admins for ADMIN-level commands', async () => {
      const cmd = createCommand({ user: [PermissionLevel.ADMIN] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isAdmin: true });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-admins for ADMIN-level commands', async () => {
      const cmd = createCommand({ user: [PermissionLevel.ADMIN] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isAdmin: false, isOwner: false });

      await middleware.execute(ctx, mockNext);

      expect(ctx.reply).toHaveBeenCalledWith('❌ No tienes permiso para usar este comando');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow everyone for USER-level commands', async () => {
      const cmd = createCommand({ user: [PermissionLevel.USER] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isOwner: false, isAdmin: false });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('bot permissions', () => {
    it('should require the bot to be admin when BotPermission.ADMIN is set', async () => {
      const cmd = createCommand({ bot: [BotPermission.ADMIN] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isBotAdmin: false });

      await middleware.execute(ctx, mockNext);

      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ El bot necesita ser admin para ejecutar este comando',
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow the command when the bot is admin', async () => {
      const cmd = createCommand({ bot: [BotPermission.ADMIN] });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isBotAdmin: true });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should not check bot permissions when no bot permission is required', async () => {
      const cmd = createCommand();
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isBotAdmin: false });

      await middleware.execute(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('check order', () => {
    it('should reply about missing user permission before checking bot permissions', async () => {
      const cmd = createCommand({
        user: [PermissionLevel.ADMIN],
        bot: [BotPermission.ADMIN],
      });
      const registryGet = vi.fn().mockReturnValue(cmd);
      middleware = new PermissionMiddleware({ get: registryGet } as never);
      const ctx = createCtx({ isAdmin: false, isBotAdmin: false });

      await middleware.execute(ctx, mockNext);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith('❌ No tienes permiso para usar este comando');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
