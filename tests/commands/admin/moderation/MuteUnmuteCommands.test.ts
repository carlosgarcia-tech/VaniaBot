/**
 * MuteUnmuteCommands.test.ts
 *
 * Regression tests for the mute/unmute deadlock: the database is the source
 * of truth, the middleware cache is only an accelerator — unmute must work
 * even when the cache entry is gone (restart, LRU eviction, rejoin).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MuteCommand } from '@/commands/admin/moderation/MuteCommand.js';
import { UnmuteCommand } from '@/commands/admin/moderation/UnmuteCommand.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { middlewareCache } from '@/middlewares/MiddlewareCache.js';
import type { MessageContext } from '@/types/index.js';

vi.mock('@/services/system/Servicemanager', () => ({
  serviceManager: {
    userService: {
      getUser: vi.fn(),
    },
    moderationService: {
      isMuted: vi.fn(),
      muteUser: vi.fn(),
      unmuteUser: vi.fn(),
    },
  },
}));

import { serviceManager as realManager } from '@/services/system/Servicemanager';

const mocks = realManager as unknown as {
  userService: { getUser: ReturnType<typeof vi.fn> };
  moderationService: {
    isMuted: ReturnType<typeof vi.fn>;
    muteUser: ReturnType<typeof vi.fn>;
    unmuteUser: ReturnType<typeof vi.fn>;
  };
};

const TARGET = 'target@s.whatsapp.net';
const ADMIN = 'admin@s.whatsapp.net';
const GROUP = 'group@g.us';

const createCtx = (args: string[]): MessageContext =>
  ({
    command: '',
    args,
    text: '',
    mentionedJid: TARGET,
    message: { key: { id: 'm1', remoteJid: GROUP, fromMe: false, participant: ADMIN } },
    sock: {},
    chat: { jid: GROUP, isGroup: true, isBotAdmin: true },
    sender: { jid: ADMIN, pushName: 'Admin', isOwner: false, isAdmin: true },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    loadBotPermissions: vi.fn().mockResolvedValue(undefined),
    loadSenderPermissions: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

const mockUser = { jid: TARGET, name: 'Target', isOwner: false };

describe('MuteCommand', () => {
  let command: MuteCommand;
  let ctx: MessageContext;

  beforeEach(() => {
    command = new MuteCommand();
    ctx = createCtx([`@${TARGET.split('@')[0]}`, '10m', 'spam']);
    vi.clearAllMocks();
    middlewareCache.userMuted.clear();
    mocks.userService.getUser.mockResolvedValue(mockUser);
  });

  it('still refuses to mute someone the DB says is already muted', async () => {
    mocks.moderationService.isMuted.mockResolvedValue(true);
    await command.execute(ctx);
    expect(mocks.moderationService.muteUser).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('This user is already muted');
  });

  it('stores the cache flag with the mute duration as TTL', async () => {
    const setSpy = vi.spyOn(middlewareCache.userMuted, 'set');
    mocks.moderationService.isMuted.mockResolvedValue(false);
    mocks.moderationService.muteUser.mockResolvedValue(undefined);

    await command.execute(ctx);

    expect(mocks.moderationService.muteUser).toHaveBeenCalledWith(
      GROUP,
      TARGET,
      'Target',
      'Admin',
      'spam',
      10 * 60 * 1000,
    );
    // 10 minutes, NOT the cache-wide 24h default — expired mutes stop applying.
    expect(setSpy).toHaveBeenCalledWith(
      `${GROUP}:${TARGET}`,
      { value: true },
      { ttlMs: 10 * 60 * 1000 },
    );
  });
});

describe('UnmuteCommand', () => {
  let command: UnmuteCommand;
  let ctx: MessageContext;

  beforeEach(() => {
    command = new UnmuteCommand();
    ctx = createCtx([`@${TARGET.split('@')[0]}`]);
    vi.clearAllMocks();
    middlewareCache.userMuted.clear();
    mocks.userService.getUser.mockResolvedValue(mockUser);
  });

  it('unmutes from the DB even when the cache entry is gone (the reported deadlock)', async () => {
    mocks.moderationService.isMuted.mockResolvedValue(true); // DB: muted
    // cache: empty (restart / eviction / rejoin)

    await command.execute(ctx);

    expect(mocks.moderationService.unmuteUser).toHaveBeenCalledWith(GROUP, TARGET);
    expect((ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain('Silence');
  });

  it('says not muted when neither DB nor cache know about a mute', async () => {
    mocks.moderationService.isMuted.mockResolvedValue(false);

    await command.execute(ctx);

    expect(mocks.moderationService.unmuteUser).not.toHaveBeenCalled();
    expect((ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain('no está muteado');
  });

  it('does not get fooled by a stale cache flag when the mute already expired', async () => {
    middlewareCache.userMuted.set(`${GROUP}:${TARGET}`, { value: true });
    mocks.moderationService.isMuted.mockResolvedValue(false); // DB: expired/auto-cleaned

    await command.execute(ctx);

    expect(mocks.moderationService.unmuteUser).not.toHaveBeenCalled();
    expect((ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain('no está muteado');
    expect(middlewareCache.userMuted.get(`${GROUP}:${TARGET}`)).toBeUndefined(); // stale flag dropped
  });
});
