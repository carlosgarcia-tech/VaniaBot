/**
 * SubBotMessageHandler.test.ts
 *
 * Unit tests for the subbot message pipeline and group-update handling,
 * including the new AntiArab guard wired into handleGroupUpdate.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WASocket, WAMessage, BaileysEventMap } from 'baileys';
import { SubBotMessageHandler } from '../../../src/services/subbot/SubBotMessageHandler.js';
import { commandRegistry } from '../../../src/core/CommandRegistry.js';
import { cacheManager } from '../../../src/core/CacheManager.js';
import {
  CommandCategory,
  type ICommand,
  type IMiddleware,
  type MessageContext as IMessageContext,
} from '../../../src/types/index.js';
import type { SubBotConfig } from '../../../src/types/subbot.js';
import type { AntiSpamService } from '../../../src/services/system/AntiSpamService.js';

// --- Module mocks ----------------------------------------------------------

const mockMarkDedup = vi.fn();
const mockIsAllowedForSubbot = vi.fn();
const mockIsMuted = vi.fn();
const mockQuizHandle = vi.fn();
const mockHandleMention = vi.fn();
const mockHandleReaccion = vi.fn();
const mockGetCommand = vi.fn();
const mockGetLastStartupAt = vi.fn();
const mockMarkProcessed = vi.fn();
const mockHandleNewParticipant = vi.fn();
const mockHandleParticipantLeft = vi.fn();
const mockAntiArabIsEnabled = vi.fn();
const mockAntiArabShouldBlock = vi.fn();
const mockGetGroup = vi.fn();

vi.mock('../../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    vaniaToggleService: {
      isAllowedForSubbot: (...args: unknown[]) => mockIsAllowedForSubbot(...args),
      isEnabled: (...args: unknown[]) => mockIsAllowedForSubbot(...args),
    },
    moderationService: {
      isMuted: (...args: unknown[]) => mockIsMuted(...args),
    },
    groupService: {
      getGroup: (...args: unknown[]) => mockGetGroup(...args),
    },
  },
}));

vi.mock('../../../src/core/PluginLoader.js', () => ({
  pluginLoader: {
    getCommand: (...args: unknown[]) => mockGetCommand(...args),
  },
}));

vi.mock('../../../src/repositories/RuntimeStateRepository.js', () => ({
  runtimeStateRepository: {
    getLastStartupAt: (...args: unknown[]) => mockGetLastStartupAt(...args),
  },
}));

vi.mock('../../../src/repositories/ProcessedMessagesRepository.js', () => ({
  processedMessagesRepository: {
    markProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
  },
}));

vi.mock('../../../src/handlers/ReaccionHandler.js', () => ({
  handleReaccion: (...args: unknown[]) => mockHandleReaccion(...args),
}));

vi.mock('../../../src/handlers/QuizAnswerHandler.js', () => ({
  quizAnswerHandler: {
    handle: (...args: unknown[]) => mockQuizHandle(...args),
  },
}));

vi.mock('../../../src/handlers/AiMentionHandler.js', () => ({
  handleMention: (...args: unknown[]) => mockHandleMention(...args),
}));

vi.mock('../../../src/services/system/WelcomeService.js', () => ({
  welcomeService: {
    handleNewParticipant: (...args: unknown[]) => mockHandleNewParticipant(...args),
    handleParticipantLeft: (...args: unknown[]) => mockHandleParticipantLeft(...args),
  },
}));

vi.mock('../../../src/services/moderation/AntiArabService.js', () => ({
  antiArabService: {
    isEnabled: (...args: unknown[]) => mockAntiArabIsEnabled(...args),
    shouldBlockNumber: (...args: unknown[]) => mockAntiArabShouldBlock(...args),
  },
}));

// MessageContext is real; its permission lookups are mocked.
vi.mock('../../../src/services/PermissionService.js', () => ({
  normalizeJid: (jid: string) => jid,
  PermissionService: {
    isOwner: () => false,
    isOwnerAsync: async () => false,
    getUserPermissions: vi.fn().mockResolvedValue({ isAdmin: false, isOwner: false }),
    getBotPermissions: vi.fn().mockResolvedValue({ isAdmin: false }),
  },
}));

// --- Fixtures --------------------------------------------------------------

const GROUP_JID = '120363012345678888@g.us';
const SENDER_JID = '15551234567@s.whatsapp.net';
const BLOCKED_JID = '212600000000@s.whatsapp.net';
const BOT_JID = '15559998888@s.whatsapp.net';

const makeSubConfig = (): SubBotConfig =>
  ({
    id: 'subbot-test-1',
    ownerJid: SENDER_JID,
    ownerName: 'Owner',
    phoneNumber: '15551234567',
    sessionPath: '/tmp/subbot-test',
    prefix: '.',
    name: 'TestSubBot',
    active: true,
    createdAt: Date.now(),
    status: 'connected',
    slot: 2,
    label: 'slot-2',
  }) as SubBotConfig;

const makeSocket = () => ({
  user: { id: BOT_JID },
  sendMessage: vi.fn().mockResolvedValue(undefined),
  groupParticipantsUpdate: vi.fn().mockResolvedValue(undefined),
});

const makeMessage = (text: string, overrides: Record<string, unknown> = {}): WAMessage =>
  ({
    key: {
      id: 'msg-1',
      remoteJid: GROUP_JID,
      fromMe: false,
      participant: SENDER_JID,
    },
    pushName: 'Tester',
    message: { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  }) as unknown as WAMessage;

const makeGroupUpdate = (
  action: 'add' | 'remove' | 'promote' | 'demote',
  participants: Array<string | { id?: string }>,
): BaileysEventMap['group-participants.update'] =>
  ({ id: GROUP_JID, action, participants }) as BaileysEventMap['group-participants.update'];

const registerCommand = (name: string, extra: Partial<ICommand> = {}) => {
  const execute = vi.fn().mockResolvedValue(undefined);
  const command: ICommand = {
    name,
    description: `test ${name}`,
    category: CommandCategory.UTILITY,
    execute,
    ...extra,
  };
  commandRegistry.register(command);
  return { command, execute };
};

const makeMiddleware = (
  name: string,
  order: string[],
  behavior: 'pass' | 'stop',
): IMiddleware =>
  ({
    name,
    execute: async (_ctx: IMessageContext, next: () => Promise<void>) => {
      order.push(name);
      if (behavior === 'pass') await next();
    },
  }) as unknown as IMiddleware;

const flush = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

// --- Tests -----------------------------------------------------------------

describe('SubBotMessageHandler', () => {
  let sock: ReturnType<typeof makeSocket>;
  let subConfig: SubBotConfig;
  let handler: SubBotMessageHandler;
  let antiSpamCheck: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    sock = makeSocket();
    subConfig = makeSubConfig();
    antiSpamCheck = vi.fn().mockReturnValue({ allowed: true });

    mockMarkDedup.mockReturnValue(false);
    mockIsAllowedForSubbot.mockResolvedValue(true);
    mockIsMuted.mockResolvedValue(false);
    mockQuizHandle.mockResolvedValue(false);
    mockHandleMention.mockResolvedValue(undefined);
    mockHandleReaccion.mockResolvedValue(undefined);
    mockGetCommand.mockResolvedValue(null);
    mockGetLastStartupAt.mockReturnValue(null);
    // welcomeService handlers are fire-and-forget with .catch() chained on;
    // the mocks must return promises or the chained .catch throws synchronously.
    mockHandleNewParticipant.mockResolvedValue(undefined);
    mockHandleParticipantLeft.mockResolvedValue(undefined);
    mockAntiArabIsEnabled.mockReturnValue(false);
    mockAntiArabShouldBlock.mockReturnValue(false);
    mockGetGroup.mockResolvedValue({ id: GROUP_JID });

    handler = new SubBotMessageHandler(
      () => [],
      () => ({ check: antiSpamCheck }) as unknown as AntiSpamService,
      (botId, msg) => mockMarkDedup(botId, msg),
    );
  });

  afterEach(() => {
    cacheManager.clear();
    // Registered test commands must not leak between tests.
    for (const name of ['subping', 'suberr']) {
      (commandRegistry as unknown as { commands: Map<string, ICommand> }).commands.delete(name);
    }
  });

  describe('handleMessage - early filters', () => {
    it('ignores messages without body or from the bot itself', async () => {
      await handler.handleMessage(makeMessage('', { message: undefined }), sock, subConfig);
      await handler.handleMessage(
        makeMessage('.subping', { key: { id: 'm2', remoteJid: GROUP_JID, fromMe: true } }),
        sock,
        subConfig,
      );

      expect(mockMarkDedup).not.toHaveBeenCalled();
      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });

    it('ignores messages without id', async () => {
      await handler.handleMessage(
        makeMessage('.subping', { key: { id: undefined, remoteJid: GROUP_JID } }),
        sock,
        subConfig,
      );

      expect(mockMarkDedup).not.toHaveBeenCalled();
    });

    it('stops when dedup marks the message as duplicate', async () => {
      mockMarkDedup.mockReturnValue(true);

      await handler.handleMessage(makeMessage('.subping'), sock, subConfig);

      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });

    it('skips pre-startup echoes and marks them processed', async () => {
      mockGetLastStartupAt.mockReturnValue(new Date(Date.now() + 60_000).toISOString());

      await handler.handleMessage(makeMessage('.subping'), sock, subConfig);

      expect(mockMarkProcessed).toHaveBeenCalledWith('msg-1', subConfig.id);
      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage - guards', () => {
    it('routes reactions to handleReaccion and skips the command chain', async () => {
      const { execute } = registerCommand('subping');
      const msg = makeMessage('', {
        message: { reactionMessage: { key: { id: 'r1' }, text: '👍' } },
      });

      await handler.handleMessage(msg, sock, subConfig);

      expect(mockHandleReaccion).toHaveBeenCalledWith(sock, msg);
      expect(execute).not.toHaveBeenCalled();
    });

    it('skips bare vania-toggle commands (they belong to the main bot)', async () => {
      const { execute } = registerCommand('vaniaon');

      await handler.handleMessage(makeMessage('.vaniaon'), sock, subConfig);

      expect(execute).not.toHaveBeenCalled();
      expect(mockIsAllowedForSubbot).not.toHaveBeenCalled();
    });

    it('drops messages when the vania toggle guard denies the subbot', async () => {
      const { execute } = registerCommand('subping');
      mockIsAllowedForSubbot.mockResolvedValue(false);

      await handler.handleMessage(makeMessage('.subping'), sock, subConfig);

      expect(execute).not.toHaveBeenCalled();
    });

    it('deletes and drops messages from muted users when the bot is admin', async () => {
      const { execute } = registerCommand('subping');
      mockIsMuted.mockResolvedValue(true);
      sock.sendMessage.mockClear();

      await handler.handleMessage(
        makeMessage('.subping', {
          message: { extendedTextMessage: { text: '.subping' } },
        }),
        sock,
        subConfig,
      );

      // ctx.chat.isBotAdmin comes from the mocked getBotPermissions → false.
      expect(sock.sendMessage).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('routes non-command group chatter to quiz and AI mention handlers', async () => {
      const { execute } = registerCommand('subping');

      await handler.handleMessage(makeMessage('hola subbot'), sock, subConfig);

      expect(mockQuizHandle).toHaveBeenCalledWith(expect.anything());
      expect(mockHandleMention).toHaveBeenCalledWith(expect.anything(), BOT_JID);
      expect(execute).not.toHaveBeenCalled();
    });

    it('replies and stops when anti-spam denies the user', async () => {
      const { execute } = registerCommand('subping');
      antiSpamCheck.mockReturnValue({ allowed: false, reason: '⛔ Bloqueado' });

      await handler.handleMessage(makeMessage('.subping'), sock, subConfig);

      expect(antiSpamCheck).toHaveBeenCalledWith(SENDER_JID);
      expect(sock.sendMessage).toHaveBeenCalledWith(
        GROUP_JID,
        expect.objectContaining({ text: '⛔ Bloqueado' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
      expect(execute).not.toHaveBeenCalled();
    });

    it('executes registry commands with parsed args and marks them processed', async () => {
      const { execute } = registerCommand('subping');
      const msg = makeMessage('.subping hola');

      await handler.handleMessage(msg, sock, subConfig);

      expect(execute).toHaveBeenCalledTimes(1);
      const ctx = execute.mock.calls[0][0] as IMessageContext;
      expect(ctx.command).toBe('subping');
      expect(ctx.args).toEqual(['hola']);
      expect(cacheManager.hasProcessedMessage('msg-1')).toBe(true);
    });

    it('lazy-loads unknown commands via the plugin loader', async () => {
      const lazyExecute = vi.fn().mockResolvedValue(undefined);
      const lazyCommand: ICommand = {
        name: 'sublazy',
        description: 'lazy',
        category: CommandCategory.UTILITY,
        execute: lazyExecute,
      };
      mockGetCommand.mockResolvedValue(lazyCommand);

      await handler.handleMessage(makeMessage('.sublazy'), sock, subConfig);

      expect(mockGetCommand).toHaveBeenCalledWith('sublazy');
      expect(commandRegistry.get('sublazy')).toBe(lazyCommand);
      expect(lazyExecute).toHaveBeenCalledTimes(1);
      (commandRegistry as unknown as { commands: Map<string, ICommand> }).commands.delete('sublazy');
    });

    it('replies with a friendly error when the command throws', async () => {
      const { execute } = registerCommand('suberr');
      execute.mockRejectedValue(new Error('boom'));

      await handler.handleMessage(makeMessage('.suberr'), sock, subConfig);

      expect(sock.sendMessage).toHaveBeenCalledWith(
        GROUP_JID,
        expect.objectContaining({ text: expect.stringContaining('error') }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
      expect(cacheManager.hasProcessedMessage('msg-1')).toBe(true);
    });
  });

  describe('handleMessage - middleware orchestration', () => {
    it('runs parallel batch first, then sequential middlewares, then the handler', async () => {
      const order: string[] = [];
      const middlewares = [
        { middleware: makeMiddleware('par1', order, 'stop'), priority: 1, canRunParallel: true },
        { middleware: makeMiddleware('par2', order, 'stop'), priority: 2, canRunParallel: true },
        { middleware: makeMiddleware('seq1', order, 'pass'), priority: 5, canRunParallel: false },
      ];
      handler = new SubBotMessageHandler(
        () => middlewares,
        () => ({ check: antiSpamCheck }) as unknown as AntiSpamService,
        (botId, msg) => mockMarkDedup(botId, msg),
      );
      const { execute } = registerCommand('subping');

      await handler.handleMessage(makeMessage('.subping'), sock, subConfig);

      expect(order).toEqual(['par1', 'par2', 'seq1']);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('never reaches the handler when a sequential middleware blocks', async () => {
      const order: string[] = [];
      const middlewares = [
        { middleware: makeMiddleware('blocker', order, 'stop'), priority: 5, canRunParallel: false },
      ];
      handler = new SubBotMessageHandler(
        () => middlewares,
        () => ({ check: antiSpamCheck }) as unknown as AntiSpamService,
        (botId, msg) => mockMarkDedup(botId, msg),
      );
      const { execute } = registerCommand('subping');

      await handler.handleMessage(makeMessage('.subping'), sock, subConfig);

      expect(order).toEqual(['blocker']);
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe('handleGroupUpdate', () => {
    it('invalidates group metadata and loads the group', async () => {
      await handler.handleGroupUpdate(makeGroupUpdate('add', [SENDER_JID]), sock, subConfig.id);

      expect(mockGetGroup).toHaveBeenCalledWith(GROUP_JID);
    });

    it('returns early when the subbot is not enabled in the chat', async () => {
      mockIsAllowedForSubbot.mockResolvedValue(false);

      await handler.handleGroupUpdate(makeGroupUpdate('add', [SENDER_JID]), sock, subConfig.id);

      expect(mockHandleNewParticipant).not.toHaveBeenCalled();
      expect(mockAntiArabIsEnabled).not.toHaveBeenCalled();
    });

    it('sends welcome for added participants and goodbye for removed ones', async () => {
      await handler.handleGroupUpdate(makeGroupUpdate('add', [SENDER_JID]), sock, subConfig.id);
      await handler.handleGroupUpdate(
        makeGroupUpdate('remove', [SENDER_JID]),
        sock,
        subConfig.id,
      );
      await flush();

      expect(mockHandleNewParticipant).toHaveBeenCalledWith(sock, GROUP_JID, SENDER_JID);
      expect(mockHandleParticipantLeft).toHaveBeenCalledWith(
        sock,
        GROUP_JID,
        SENDER_JID,
        subConfig.id,
      );
    });

    it('ignores updates without group id or participants', async () => {
      await handler.handleGroupUpdate(
        { id: undefined, action: 'add', participants: [] } as unknown as BaileysEventMap['group-participants.update'],
        sock,
        subConfig.id,
      );

      expect(mockGetGroup).not.toHaveBeenCalled();
    });
  });

  describe('handleGroupUpdate - AntiArab guard', () => {
    beforeEach(() => {
      // Group must be enabled for the subbot so the guard chain reaches AntiArab.
      mockIsAllowedForSubbot.mockResolvedValue(true);
    });

    it('kicks newly added participants matching blocked prefixes', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handler.handleGroupUpdate(makeGroupUpdate('add', [BLOCKED_JID]), sock, subConfig.id);

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

      await handler.handleGroupUpdate(makeGroupUpdate('add', [SENDER_JID]), sock, subConfig.id);

      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });

    it('never kicks the bot itself', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handler.handleGroupUpdate(makeGroupUpdate('add', [BOT_JID]), sock, subConfig.id);

      expect(mockAntiArabShouldBlock).not.toHaveBeenCalled();
      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });

    it('does nothing on remove actions even when antiarab is enabled', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handler.handleGroupUpdate(
        makeGroupUpdate('remove', [BLOCKED_JID]),
        sock,
        subConfig.id,
      );

      expect(mockAntiArabIsEnabled).not.toHaveBeenCalled();
      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });

    it('continues kicking remaining participants when one removal fails', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);
      sock.groupParticipantsUpdate
        .mockRejectedValueOnce(new Error('kick failed'))
        .mockResolvedValueOnce(undefined);

      await handler.handleGroupUpdate(
        makeGroupUpdate('add', [BLOCKED_JID, SENDER_JID]),
        sock,
        subConfig.id,
      );

      expect(sock.groupParticipantsUpdate).toHaveBeenCalledTimes(2);
    });

    it('handles string and object participant shapes', async () => {
      mockAntiArabIsEnabled.mockReturnValue(true);
      mockAntiArabShouldBlock.mockReturnValue(true);

      await handler.handleGroupUpdate(
        makeGroupUpdate('add', [{ id: BLOCKED_JID }, '212700000000@s.whatsapp.net']),
        sock,
        subConfig.id,
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

      await handler.handleGroupUpdate(
        makeGroupUpdate('add', [{ id: undefined }]),
        sock,
        subConfig.id,
      );

      expect(mockAntiArabShouldBlock).not.toHaveBeenCalled();
      expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    });
  });
});
