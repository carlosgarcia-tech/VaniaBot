/**
 * MuteMiddleware.test.ts
 *
 * The middleware must fall back to the database when the in-memory cache has
 * no entry (restart, LRU eviction, rejoin) — otherwise a persisted mute
 * becomes inoperative until someone re-mutes the user.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MuteMiddleware } from '@/middlewares/MuteMiddleware.js';
import { middlewareCache } from '@/middlewares/MiddlewareCache.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import type { MessageContext } from '@/types/index.js';

vi.mock('@/services/system/Servicemanager', () => ({
  serviceManager: {
    moderationService: {
      getMuteInfo: vi.fn(),
    },
  },
}));

const mockManager = serviceManager as unknown as {
  moderationService: { getMuteInfo: ReturnType<typeof vi.fn> };
};

const GROUP = 'group@g.us';
const SENDER = 'sender@s.whatsapp.net';

const createCtx = (): MessageContext =>
  ({
    message: { key: { id: 'm1', remoteJid: GROUP, fromMe: false, participant: SENDER } },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    chat: { jid: GROUP, isGroup: true, isBotAdmin: true },
    sender: { jid: SENDER, pushName: 'S', isOwner: false, isAdmin: false },
    loadBotPermissions: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

describe('MuteMiddleware', () => {
  let middleware: MuteMiddleware;
  let ctx: MessageContext;
  const next = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    middleware = new MuteMiddleware();
    ctx = createCtx();
    vi.clearAllMocks();
    next.mockClear();
    middlewareCache.userMuted.clear();
  });

  it('still deletes messages of a cached muted user (fast path intact)', async () => {
    middlewareCache.userMuted.set(`${GROUP}:${SENDER}`, { value: true });
    mockManager.moderationService.getMuteInfo.mockResolvedValue({ expiresAt: Date.now() + 60000 });

    await middleware.execute(ctx, next);

    expect(ctx.sock.sendMessage).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(mockManager.moderationService.getMuteInfo).not.toHaveBeenCalled();
  });

  it('falls back to the DB on a cache miss and hydrates the cache', async () => {
    mockManager.moderationService.getMuteInfo.mockResolvedValue({
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await middleware.execute(ctx, next);

    expect(ctx.sock.sendMessage).toHaveBeenCalled(); // message deleted
    expect(next).not.toHaveBeenCalled();
    // hydrated, so the next message hits the cache again
    expect(middlewareCache.userMuted.get(`${GROUP}:${SENDER}`)).toEqual({ value: true });
  });

  it('lets the message through when neither cache nor DB have a mute', async () => {
    mockManager.moderationService.getMuteInfo.mockResolvedValue(null);

    await middleware.execute(ctx, next);

    expect(ctx.sock.sendMessage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
