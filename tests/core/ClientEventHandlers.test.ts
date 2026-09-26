/**
 * ClientEventHandlers.test.ts
 *
 * Unit tests for the main-bot event handlers: anti-call rejection,
 * anti-delete notifications, group updates (welcome/goodbye) and the
 * AntiArab kick guard wired into handleGroupUpdate.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WASocket, BaileysEventMap } from 'baileys';
import { ClientEventHandlers } from '../../src/core/ClientEventHandlers.js';

// --- Module mocks ----------------------------------------------------------

const mockGetGroup = vi.fn();
const mockWelcomeNew = vi.fn();
const mockWelcomeLeft = vi.fn();
const mockAntiArabIsEnabled = vi.fn();
const mockAntiArabShouldBlock = vi.fn();
const mockAntiCallIsEnabled = vi.fn();
const mockAntiCallShouldBlock = vi.fn();
const mockGetMessage = vi.fn();
const mockDeleteMessage = vi.fn();
const mockGetGroupAdmins = vi.fn();
const mockInvalidateGroupMetadata = vi.fn();
const mockInvalidatePermissions = vi.fn();

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    groupService: {
      getGroup: (...args: unknown[]) => mockGetGroup(...args),
    },
    moderationService: {},
  },
}));

vi.mock('../../src/services/system/WelcomeService.js', () => ({
  welcomeService: {
    handleNewParticipant: (...args: unknown[]) => mockWelcomeNew(...args),
    handleParticipantLeft: (...args: unknown[]) => mockWelcomeLeft(...args),
  },
}));

vi.mock('../../src/services/moderation/AntiArabService.js', () => ({
  antiArabService: {
    isEnabled: (...args: unknown[]) => mockAntiArabIsEnabled(...args),
    shouldBlockNumber: (...args: unknown[]) => mockAntiArabShouldBlock(...args),
  },
}));

vi.mock('../../src/services/system/AntiCallService.js', () => ({
  antiCallService: {
    isEnabled: (...args: unknown[]) => mockAntiCallIsEnabled(...args),
    shouldBlock: (...args: unknown[]) => mockAntiCallShouldBlock(...args),
  },
}));

vi.mock('../../src/services/system/AntiDeleteService.js', () => ({
  antiDeleteService: {
    getMessage: (...args: unknown[]) => mockGetMessage(...args),
    deleteMessage: (...args: unknown[]) => mockDeleteMessage(...args),
    formatDeletedMessageNotification: vi
      .fn()
      .mockReturnValue('notification text'),
  },
}));

vi.mock('../../src/services/PermissionService.js', () => ({
  PermissionService: {
    getGroupAdmins: (...args: unknown[]) => mockGetGroupAdmins(...args),
  },
}));

vi.mock('../../src/core/CacheManager.js', () => ({
  cacheManager: {
    invalidateGroupMetadata: (...args: unknown[]) => mockInvalidateGroupMetadata(...args),
    invalidatePermissions: (...args: unknown[]) => mockInvalidatePermissions(...args),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    OWNER_JID: 'owner@s.whatsapp.net',
  },
}));

// --- Fixtures --------------------------------------------------------------

const GROUP_JID = '120363012345678888@g.us';
const SENDER_JID = '15551234567@s.whatsapp.net';
const BLOCKED_JID = '212600000000@s.whatsapp.net';
const BOT_JID = '15559998888@s.whatsapp.net';

const makeSocket = () =>
  ({
    user: { id: BOT_JID },
    rejectCall: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    groupParticipantsUpdate: vi.fn().mockResolvedValue(undefined),
  }) as unknown as WASocket & {
    rejectCall: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    groupParticipantsUpdate: ReturnType<typeof vi.fn>;
  };

const makeGroupUpdate = (
  action: 'add' | 'remove' | 'promote' | 'demote',
  participants: Array<string | { id?: string }>,
): BaileysEventMap['group-participants.update'] =>
  ({ id: GROUP_JID, action, participants }) as BaileysEventMap['group-participants.update'];

const flush = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

// --- Tests -----------------------------------------------------------------

describe('ClientEventHandlers', () => {
  let handlers: ClientEventHandlers;
  let sock: ReturnType<typeof makeSocket>;

  beforeEach(() => {
    vi.clearAllMocks();

    sock = makeSocket();
    handlers = new ClientEventHandlers();

    mockGetGroup.mockResolvedValue({ id: GROUP_JID });
    mockWelcomeNew.mockResolvedValue(undefined);
    mockWelcomeLeft.mockResolvedValue(undefined);
    mockAntiArabIsEnabled.mockReturnValue(false);
    mockAntiArabShouldBlock.mockReturnValue(false);
    mockAntiCallIsEnabled.mockReturnValue(false);
    mockAntiCallShouldBlock.mockReturnValue(false);
    mockGetMessage.mockReturnValue(undefined);
    mockGetGroupAdmins.mockResolvedValue([]);
  });

  describe('handleGroupUpdate', () => {
    it('invalidates group metadata and loads the group', async () => {
      await handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [SENDER_JID]));

      expect(mockInvalidateGroupMetadata).toHaveBeenCalledWith(GROUP_JID);
      expect(mockGetGroup).toHaveBeenCalledWith(GROUP_JID);
    });

    it('invalidates bot permissions when the bot itself is affected', async () => {
      await handlers.handleGroupUpdate(sock, makeGroupUpdate('promote', [BOT_JID]));

      expect(mockInvalidatePermissions).toHaveBeenCalledWith(GROUP_JID);
    });

    it('does not invalidate bot permissions for other participants', async () => {
      await handlers.handleGroupUpdate(sock, makeGroupUpdate('promote', [SENDER_JID]));

      expect(mockInvalidatePermissions).not.toHaveBeenCalled();
    });

    it('triggers welcome on add and goodbye on remove', async () => {
      await handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [SENDER_JID]));
      await handlers.handleGroupUpdate(sock, makeGroupUpdate('remove', [SENDER_JID]));
      await flush();

      expect(mockWelcomeNew).toHaveBeenCalledWith(sock, GROUP_JID, SENDER_JID);
      expect(mockWelcomeLeft).toHaveBeenCalledWith(sock, GROUP_JID, SENDER_JID, 'main');
    });

    it('returns early when group id or participants are missing', async () => {
      await handlers.handleGroupUpdate(
        sock,
        {} as unknown as BaileysEventMap['group-participants.update'],
      );

      expect(mockGetGroup).not.toHaveBeenCalled();
    });

    it('swallows service errors without throwing', async () => {
      mockGetGroup.mockRejectedValue(new Error('db down'));

      await expect(
        handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [SENDER_JID])),
      ).resolves.toBeUndefined();

      // The error aborts the handler before the welcome/AntiArab steps.
      expect(mockWelcomeNew).not.toHaveBeenCalled();
      expect(mockAntiArabIsEnabled).not.toHaveBeenCalled();
    });
  });

  describe('handleGroupUpdate - AntiArab guard', () => {
    it('kicks newly added participants matching blocked prefixes', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [BLOCKED_JID]));

      expect(mockAntiArabIsEnabled).toHaveBeenCalledWith(GROUP_JID);
      expect(mockAntiArabShouldBlock).toHaveBeenCalledWith('212600000000');
      expect(sock.groupParticipantsUpdate).toHaveBeenCalledWith(
        GROUP_JID,
        [BLOCKED_JID],
        'remove',
      );
    });

    it('does not kick participants with allowed prefixes', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(false);

      await handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [SENDER_JID]));

      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });

    it('never kicks the bot itself', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [BOT_JID]));

      expect(mockAntiArabShouldBlock).not.toHaveBeenCalled();
      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });

    it('only evaluates the guard on add actions', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handlers.handleGroupUpdate(sock, makeGroupUpdate('remove', [BLOCKED_JID]));
      await handlers.handleGroupUpdate(sock, makeGroupUpdate('promote', [BLOCKED_JID]));

      expect(mockAntiArabIsEnabled).not.toHaveBeenCalled();
      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });

    it('continues kicking remaining participants when one removal fails', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);
      sock.groupParticipantsUpdate
        .mockRejectedValueOnce(new Error('kick failed'))
        .mockResolvedValueOnce(undefined);

      await handlers.handleGroupUpdate(
        sock,
        makeGroupUpdate('add', [BLOCKED_JID, SENDER_JID]),
      );

      expect(sock.groupParticipantsUpdate).toHaveBeenCalledTimes(2);
    });

    it('handles string and object participant shapes', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handlers.handleGroupUpdate(
        sock,
        makeGroupUpdate('add', [{ id: BLOCKED_JID }, '212700000000@s.whatsapp.net']),
      );

      expect(sock.groupParticipantsUpdate).toHaveBeenCalledWith(
        GROUP_JID,
        [BLOCKED_JID],
        'remove',
      );
      expect(sock.groupParticipantsUpdate).toHaveBeenCalledWith(
        GROUP_JID,
        ['212700000000@s.whatsapp.net'],
        'remove',
      );
    });

    it('skips participants without an id', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handlers.handleGroupUpdate(sock, makeGroupUpdate('add', [{ id: undefined }]));

      expect(mockAntiArabShouldBlock).not.toHaveBeenCalled();
      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleIncomingCalls', () => {
    const makeCall = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'call-1',
        from: SENDER_JID,
        isVideo: false,
        isGroup: false,
        ...overrides,
      }) as unknown as BaileysEventMap['call'][number];

    it('does nothing when anti-call is disabled', async () => {
      await handlers.handleIncomingCalls(sock, [makeCall()]);

      expect(sock.rejectCall).not.toHaveBeenCalled();
    });

    it('rejects calls and notifies the owner', async () => {
      mockAntiCallIsEnabled.mockReturnValue(true);

      await handlers.handleIncomingCalls(sock, [makeCall()]);

      expect(sock.rejectCall).toHaveBeenCalledWith('call-1', SENDER_JID);
      expect(sock.sendMessage).toHaveBeenCalledWith(
        'owner@s.whatsapp.net',
        expect.objectContaining({ text: expect.stringContaining('LLAMADA RECHAZADA') }),
      );
    });

    it('skips blocked callers without rejecting', async () => {
      mockAntiCallIsEnabled.mockReturnValue(true);
      mockAntiCallShouldBlock.mockReturnValue(true);

      await handlers.handleIncomingCalls(sock, [makeCall()]);

      expect(sock.rejectCall).not.toHaveBeenCalled();
    });

    it('continues with the next call when rejecting one fails', async () => {
      mockAntiCallIsEnabled.mockReturnValue(true);
      sock.rejectCall
        .mockRejectedValueOnce(new Error('reject failed'))
        .mockResolvedValueOnce(undefined);

      await handlers.handleIncomingCalls(sock, [
        makeCall({ id: 'call-1' }),
        makeCall({ id: 'call-2', from: BLOCKED_JID }),
      ]);

      expect(sock.rejectCall).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleMessageDeletion', () => {
    it('notifies the owner about deleted messages and drops the stored copy', async () => {
      mockGetMessage.mockReturnValue({
        id: 'del-1',
        content: 'hola',
        sender: SENDER_JID,
        senderName: 'Tester',
        timestamp: Date.now(),
      });

      await handlers.handleMessageDeletion(sock, {
        keys: [{ id: 'del-1', remoteJid: GROUP_JID, participant: BLOCKED_JID }],
      } as unknown as BaileysEventMap['messages.delete']);

      expect(sock.sendMessage).toHaveBeenCalledWith(
        'owner@s.whatsapp.net',
        expect.objectContaining({ text: 'notification text' }),
      );
      expect(mockDeleteMessage).toHaveBeenCalledWith('del-1');
    });

    it('ignores deletions performed by the bot itself', async () => {
      await handlers.handleMessageDeletion(sock, {
        keys: [{ id: 'del-2', remoteJid: GROUP_JID, participant: BOT_JID }],
      } as unknown as BaileysEventMap['messages.delete']);

      expect(mockGetMessage).not.toHaveBeenCalled();
    });

    it('ignores messages that were never stored', async () => {
      mockGetMessage.mockReturnValue(undefined);

      await handlers.handleMessageDeletion(sock, {
        keys: [{ id: 'del-3', remoteJid: GROUP_JID, participant: BLOCKED_JID }],
      } as unknown as BaileysEventMap['messages.delete']);

      expect(sock.sendMessage).not.toHaveBeenCalled();
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });
  });
});
