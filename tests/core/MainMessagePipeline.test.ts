/**
 * MainMessagePipeline.test.ts
 *
 * Unit tests for the MainMessagePipeline core module.
 * Covers message filtering, pre-startup echo detection, the guard chain
 * (mutes, vania toggle, quiz/mention), rate limits, command resolution
 * (registry + lazy plugin loading), availability gates (disabled/NSFW),
 * timeout and error handling, middleware orchestration and stats tracking.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { WASocket, WAMessage } from 'baileys';
import { MainMessagePipeline } from '../../src/core/MainMessagePipeline.js';
import { MessageContext } from '../../src/core/MessageContext.js';
import { commandRegistry } from '../../src/core/CommandRegistry.js';
import { cacheManager } from '../../src/core/CacheManager.js';
import { middlewareCache } from '../../src/middlewares/MiddlewareCache.js';
import {
  CommandCategory,
  PermissionLevel,
  type ICommand,
  type IMiddleware,
  type MessageContext as IMessageContext,
} from '../../src/types/index.js';
import type { AntiSpamService } from '../../src/services/system/AntiSpamService.js';
import type { RealTimeMessageProcessor } from '../../src/core/RealTimeMessageProcessor.js';

// --- Module mocks ----------------------------------------------------------

const mockIsAllowedForMain = vi.fn();
const mockNsfwEnabled = vi.fn();
const mockGetCommand = vi.fn();
const mockCheckFlood = vi.fn();
const mockCheckGroupRateLimit = vi.fn();
const mockSetSocket = vi.fn();
const mockStoreMessage = vi.fn();
const mockGetLastStartupAt = vi.fn();
const mockSetStartupTimestamp = vi.fn();
const mockMarkProcessed = vi.fn();
const mockMediaGroupAdd = vi.fn();
const mockHandleReaccion = vi.fn();
const mockQuizHandle = vi.fn();
const mockHandleMention = vi.fn();
const mockHandleAudioResponse = vi.fn();
const mockGetBotPermissions = vi.fn();
const mockGetUserPermissions = vi.fn();
const mockGetBlockedLinkInfo = vi.fn();
const mockAddChatMessage = vi.fn();

vi.mock('../../src/services/system/Servicemanager.js', () => ({
  serviceManager: {
    vaniaToggleService: {
      isAllowedForMain: (...args: unknown[]) => mockIsAllowedForMain(...args),
    },
    nsfwToggleService: {
      isEnabled: (...args: unknown[]) => mockNsfwEnabled(...args),
    },
  },
}));

vi.mock('../../src/core/PluginLoader.js', () => ({
  pluginLoader: {
    getCommand: (...args: unknown[]) => mockGetCommand(...args),
  },
}));

vi.mock('../../src/services/system/RateLimitService.js', () => ({
  rateLimitService: {
    checkFlood: (...args: unknown[]) => mockCheckFlood(...args),
    checkGroupRateLimit: (...args: unknown[]) => mockCheckGroupRateLimit(...args),
  },
}));

vi.mock('../../src/services/system/PersistenceService.js', () => ({
  persistenceService: {
    setSocket: (...args: unknown[]) => mockSetSocket(...args),
  },
}));

vi.mock('../../src/services/system/AntiDeleteService.js', () => ({
  antiDeleteService: {
    storeMessage: (...args: unknown[]) => mockStoreMessage(...args),
  },
}));

vi.mock('../../src/services/moderation/AntilinkService.js', () => ({
  antilinkService: {
    getBlockedLinkInfo: (...args: unknown[]) => mockGetBlockedLinkInfo(...args),
  },
}));

vi.mock('../../src/services/chat/ChatSummaryService.js', () => ({
  chatSummaryService: {
    addMessage: (...args: unknown[]) => mockAddChatMessage(...args),
  },
}));

vi.mock('../../src/repositories/RuntimeStateRepository.js', () => ({
  runtimeStateRepository: {
    getLastStartupAt: (...args: unknown[]) => mockGetLastStartupAt(...args),
    setStartupTimestamp: (...args: unknown[]) => mockSetStartupTimestamp(...args),
  },
}));

vi.mock('../../src/repositories/ProcessedMessagesRepository.js', () => ({
  processedMessagesRepository: {
    markProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
  },
}));

vi.mock('../../src/core/MediaGroupBuffer.js', () => ({
  mediaGroupBuffer: {
    add: (...args: unknown[]) => mockMediaGroupAdd(...args),
  },
}));

vi.mock('../../src/handlers/ReaccionHandler.js', () => ({
  handleReaccion: (...args: unknown[]) => mockHandleReaccion(...args),
}));

vi.mock('../../src/handlers/QuizAnswerHandler.js', () => ({
  quizAnswerHandler: {
    handle: (...args: unknown[]) => mockQuizHandle(...args),
  },
}));

vi.mock('../../src/handlers/AiMentionHandler.js', () => ({
  handleMention: (...args: unknown[]) => mockHandleMention(...args),
}));

vi.mock('../../src/handlers/AudioResponseHandler.js', () => ({
  handleAudioResponse: (...args: unknown[]) => mockHandleAudioResponse(...args),
}));

// MessageContext is kept real; only its permission lookups are mocked.
vi.mock('../../src/services/PermissionService.js', () => ({
  normalizeJid: (jid: string) => jid,
  PermissionService: {
    isOwner: () => false,
    isOwnerAsync: async () => false,
    getUserPermissions: (...args: unknown[]) => mockGetUserPermissions(...args),
    getBotPermissions: (...args: unknown[]) => mockGetBotPermissions(...args),
  },
}));

// --- Fixtures --------------------------------------------------------------

const GROUP_JID = '120363012345678888@g.us';
const SENDER_JID = '15551234567@s.whatsapp.net';
const PRIVATE_JID = '15550001111@s.whatsapp.net';
const BOT_JID = '15559998888@s.whatsapp.net';

interface FakeMiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

interface PipelineOverrides {
  middlewares?: FakeMiddlewareConfig[];
  mainBotId?: string | null;
  lastStatsLog?: number;
}

const createStats = (lastStatsLog = Date.now()) => ({
  messagesReceived: 0,
  messagesProcessed: 0,
  commandsExecuted: 0,
  errorsCount: 0,
  spamBlocked: 0,
  totalProcessingTime: 0,
  lastStatsLog,
});

const createPipeline = (overrides: PipelineOverrides = {}) => {
  const handlers = new Map<string, (payload: unknown) => void>();
  const sock = {
    user: { id: BOT_JID },
    ev: {
      on: vi.fn((event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, handler);
      }),
    },
    sendMessage: vi.fn().mockResolvedValue(undefined),
    groupMetadata: vi.fn().mockResolvedValue({ id: GROUP_JID, participants: [] }),
    groupParticipantsUpdate: vi.fn().mockResolvedValue(undefined),
  };

  const stats = createStats(overrides.lastStatsLog);
  const commandMetrics = new Map<string, { count: number; totalTime: number; errors: number }>();
  const antiSpam = { check: vi.fn().mockReturnValue({ allowed: true }) };
  const messageProcessor = {
    process: vi.fn(async (_messageId: string, handler: () => Promise<void>) => {
      await handler();
      return true;
    }),
  };
  const logStats = vi.fn();

  const pipeline = new MainMessagePipeline(
    sock as unknown as WASocket,
    overrides.middlewares ?? [],
    antiSpam as unknown as AntiSpamService,
    messageProcessor as unknown as RealTimeMessageProcessor,
    stats,
    commandMetrics,
    overrides.mainBotId ?? null,
    logStats,
  );
  pipeline.registerListeners();

  const fire = (event: string, payload: unknown): void => {
    const handler = handlers.get(event);
    if (handler) handler(payload);
  };

  return { pipeline, sock, fire, stats, commandMetrics, antiSpam, messageProcessor, logStats };
};

let messageIdCounter = 0;

const makeMessage = (text: string, overrides: Record<string, unknown> = {}): WAMessage =>
  ({
    key: {
      id: `msg-${++messageIdCounter}`,
      remoteJid: PRIVATE_JID,
      fromMe: false,
      participant: undefined,
    },
    pushName: 'Tester',
    message: { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  }) as unknown as WAMessage;

const makeGroupMessage = (text: string, overrides: Record<string, unknown> = {}): WAMessage =>
  makeMessage(text, {
    key: {
      id: `msg-${++messageIdCounter}`,
      remoteJid: GROUP_JID,
      fromMe: false,
      participant: SENDER_JID,
    },
    ...overrides,
  });

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

const fireUpsert = (fire: (event: string, payload: unknown) => void, ...messages: WAMessage[]) => {
  fire('messages.upsert', { messages, type: 'notify' });
};

const flush = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

// --- Tests -----------------------------------------------------------------

describe('MainMessagePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsAllowedForMain.mockResolvedValue(true);
    mockNsfwEnabled.mockResolvedValue(true);
    mockGetCommand.mockResolvedValue(null);
    mockCheckFlood.mockReturnValue({ allowed: true });
    mockCheckGroupRateLimit.mockReturnValue({ allowed: true });
    mockStoreMessage.mockResolvedValue(undefined);
    mockGetLastStartupAt.mockReturnValue(null);
    mockHandleReaccion.mockResolvedValue(undefined);
    mockQuizHandle.mockResolvedValue(false);
    mockHandleMention.mockResolvedValue(undefined);
    mockHandleAudioResponse.mockResolvedValue(undefined);
    mockGetBotPermissions.mockResolvedValue({ isAdmin: false, isSuperAdmin: false });
    mockGetUserPermissions.mockResolvedValue({ isAdmin: false, isOwner: false, isSuperAdmin: false });
    mockGetBlockedLinkInfo.mockReturnValue({ blocked: false, link: null, action: 'delete' });
    mockAddChatMessage.mockClear();
  });

  afterEach(() => {
    middlewareCache.clear();
    cacheManager.clear();
    vi.useRealTimers();
  });

  afterAll(() => {
    cacheManager.stop();
  });

  describe('listener filters', () => {
    it('ignores upserts that are not notifications', async () => {
      const { fire, stats } = createPipeline();
      const msg = makeMessage('hello');

      fire('messages.upsert', { messages: [msg], type: 'append' });
      await flush();

      expect(mockHandleAudioResponse).not.toHaveBeenCalled();
      expect(mockStoreMessage).not.toHaveBeenCalled();
      expect(stats.messagesReceived).toBe(0);
    });

    it('never processes messages sent by the bot itself', async () => {
      const { fire, stats, antiSpam } = createPipeline();
      const msg = makeMessage('.pipeping', { key: { id: 'self-1', remoteJid: PRIVATE_JID, fromMe: true } });

      fireUpsert(fire, msg);
      await flush();

      expect(stats.messagesReceived).toBe(0);
      expect(antiSpam.check).not.toHaveBeenCalled();
      expect(cacheManager.hasProcessedMessage('self-1')).toBe(false);
    });

    it('ignores messages without a body', async () => {
      const { fire, stats } = createPipeline();
      const msg = makeMessage('', { message: undefined });

      fireUpsert(fire, msg);
      await flush();

      expect(stats.messagesReceived).toBe(0);
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(false);
    });

    it('ignores messages without an id', async () => {
      const { fire, stats } = createPipeline();
      const msg = makeMessage('hello', { key: { id: undefined, remoteJid: PRIVATE_JID, fromMe: false } });

      fireUpsert(fire, msg);
      await flush();

      expect(stats.messagesReceived).toBe(0);
    });

    it('ignores messages already marked as processed', async () => {
      const { fire, stats } = createPipeline();
      const msg = makeMessage('hello');
      cacheManager.markMessageProcessed(String(msg.key.id));

      fireUpsert(fire, msg);
      await flush();

      expect(stats.messagesReceived).toBe(0);
    });

    it('marks pre-startup echoes as processed without counting them', async () => {
      mockGetLastStartupAt.mockReturnValue(new Date(Date.now() + 60_000).toISOString());
      const { fire, stats } = createPipeline({ mainBotId: BOT_JID });
      const msg = makeMessage('.pipeping');

      fireUpsert(fire, msg);
      await flush();

      expect(mockGetLastStartupAt).toHaveBeenCalledWith(BOT_JID);
      expect(mockMarkProcessed).toHaveBeenCalledWith(String(msg.key.id), BOT_JID);
      expect(stats.messagesReceived).toBe(0);
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });
  });

  describe('listener side effects', () => {
    it('routes reactions to handleReaccion and skips everything else', async () => {
      const { fire, sock, stats } = createPipeline();
      const msg = makeMessage('', { message: { reactionMessage: { key: { id: 'r1' }, text: '👍' } } });

      fireUpsert(fire, msg);
      await flush();

      expect(mockHandleReaccion).toHaveBeenCalledWith(sock, msg);
      expect(mockHandleAudioResponse).not.toHaveBeenCalled();
      expect(mockStoreMessage).not.toHaveBeenCalled();
      expect(stats.messagesReceived).toBe(0);
    });

    it('hands every normal message to audio handling and anti-delete storage', async () => {
      const { fire, sock, stats } = createPipeline();
      const msg = makeMessage('hello');

      fireUpsert(fire, msg);
      await flush();

      expect(mockHandleAudioResponse).toHaveBeenCalledWith(sock, msg);
      expect(mockStoreMessage).toHaveBeenCalledWith(sock, msg);
      expect(stats.messagesReceived).toBe(1);
    });

    it('buffers group images through the media group buffer', async () => {
      const { fire } = createPipeline();
      const msg = makeGroupMessage('', { message: { imageMessage: { caption: '' } } });

      fireUpsert(fire, msg);
      await flush();

      expect(mockMediaGroupAdd).toHaveBeenCalledWith(GROUP_JID, SENDER_JID, msg);
    });
  });

  describe('connection listeners', () => {
    it('records the startup timestamp and wires the socket on connection open', () => {
      const { fire, sock } = createPipeline({ mainBotId: null });

      fire('connection.update', { connection: 'open' });

      expect(mockSetStartupTimestamp).toHaveBeenCalledWith(BOT_JID);
      expect(mockSetSocket).toHaveBeenCalledWith(sock);
    });

    it('ignores connection updates that are not "open"', () => {
      const { fire } = createPipeline({ mainBotId: null });

      fire('connection.update', { connection: 'connecting' });

      expect(mockSetStartupTimestamp).not.toHaveBeenCalled();
      expect(mockSetSocket).not.toHaveBeenCalled();
    });

    it('invalidates cached group metadata on groups.update', () => {
      const { fire } = createPipeline();
      const invalidateSpy = vi.spyOn(cacheManager, 'invalidateGroupMetadata');

      fire('groups.update', [{ id: 'group-1' }]);

      expect(invalidateSpy).toHaveBeenCalledWith('group-1');
      invalidateSpy.mockRestore();
    });
  });

  describe('group conversation routing', () => {
    it('stops at the quiz handler when the answer is handled', async () => {
      mockQuizHandle.mockResolvedValue(true);
      const { fire, stats } = createPipeline();
      const msg = makeGroupMessage('42');

      fireUpsert(fire, msg);
      await flush();

      expect(mockQuizHandle).toHaveBeenCalledWith(expect.any(MessageContext));
      expect(mockHandleMention).not.toHaveBeenCalled();
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
      expect(stats.commandsExecuted).toBe(0);
    });

    it('falls back to AI mention handling for unhandled group chatter', async () => {
      const { fire } = createPipeline();
      const msg = makeGroupMessage('hola bot');

      fireUpsert(fire, msg);
      await flush();

      expect(mockHandleMention).toHaveBeenCalledWith(expect.any(MessageContext), BOT_JID);
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });

    it('does not run conversation handlers for non-command private messages', async () => {
      const { fire } = createPipeline();
      const msg = makeMessage('hello');

      fireUpsert(fire, msg);
      await flush();

      expect(mockQuizHandle).not.toHaveBeenCalled();
      expect(mockHandleMention).not.toHaveBeenCalled();
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });
  });

  describe('guards', () => {
    it('deletes messages from muted users when the bot is group admin', async () => {
      mockGetBotPermissions.mockResolvedValue({ isAdmin: true, isSuperAdmin: false });
      const { fire, sock } = createPipeline();
      const msg = makeGroupMessage('.pipeping');
      middlewareCache.userMuted.set(`${GROUP_JID}:${SENDER_JID}`, { value: true });

      fireUpsert(fire, msg);
      await flush();

      expect(sock.sendMessage).toHaveBeenCalledWith(GROUP_JID, { delete: msg.key });
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });

    it('silently drops muted-user messages when the bot is not admin', async () => {
      const { fire, sock } = createPipeline();
      const { execute } = registerCommand('pipeping');
      const msg = makeGroupMessage('.pipeping');
      middlewareCache.userMuted.set(`${GROUP_JID}:${SENDER_JID}`, { value: true });

      fireUpsert(fire, msg);
      await flush();

      expect(sock.sendMessage).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('swallows messages when the vania toggle guard denies them', async () => {
      mockIsAllowedForMain.mockResolvedValue(false);
      const { fire, sock } = createPipeline();
      const { execute } = registerCommand('pipeping');
      const msg = makeGroupMessage('.pipeping');

      fireUpsert(fire, msg);
      await flush();

      expect(mockIsAllowedForMain).toHaveBeenCalledWith(GROUP_JID, 'pipeping', []);
      expect(execute).not.toHaveBeenCalled();
      expect(sock.sendMessage).not.toHaveBeenCalled();
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });
  });

  describe('rate limits', () => {
    it('blocks commands when the anti-spam check denies the user', async () => {
      const { fire, sock, stats, antiSpam } = createPipeline();
      const { execute } = registerCommand('pipeping');
      antiSpam.check.mockReturnValue({ allowed: false, reason: '⛔ Bloqueado por spam' });

      fireUpsert(fire, makeMessage('.pipeping'));
      await flush();

      expect(stats.spamBlocked).toBe(1);
      expect(execute).not.toHaveBeenCalled();
      expect(sock.sendMessage).toHaveBeenCalledWith(
        PRIVATE_JID,
        expect.objectContaining({ text: '⛔ Bloqueado por spam' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('blocks messages when the user flood check denies in groups', async () => {
      const { fire, sock, stats } = createPipeline();
      registerCommand('pipeping');
      mockCheckFlood.mockReturnValue({ allowed: false, reason: '⚠️ Muy rápido' });

      fireUpsert(fire, makeGroupMessage('.pipeping'));
      await flush();

      expect(mockCheckFlood).toHaveBeenCalledWith(SENDER_JID);
      expect(stats.spamBlocked).toBe(1);
      expect(sock.sendMessage).toHaveBeenCalledWith(
        GROUP_JID,
        expect.objectContaining({ text: '⚠️ Muy rápido' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('blocks messages when the group rate limit denies', async () => {
      const { fire, sock, stats } = createPipeline();
      registerCommand('pipeping');
      mockCheckGroupRateLimit.mockReturnValue({ allowed: false, reason: '⚠️ Grupo saturado' });

      fireUpsert(fire, makeGroupMessage('.pipeping'));
      await flush();

      expect(mockCheckGroupRateLimit).toHaveBeenCalledWith(GROUP_JID);
      expect(stats.spamBlocked).toBe(1);
      expect(sock.sendMessage).toHaveBeenCalledWith(
        GROUP_JID,
        expect.objectContaining({ text: '⚠️ Grupo saturado' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });
  });

  describe('antilink guard', () => {
    const blockedResult = {
      blocked: true,
      link: { raw: 'https://chat.whatsapp.com/abc', domain: 'chat.whatsapp.com', type: 'wa_group' as const },
      action: 'delete' as const,
    };

    it('deletes the message and replies when a blocked link is detected', async () => {
      mockGetBlockedLinkInfo.mockReturnValue(blockedResult);
      const { fire, sock } = createPipeline();
      const msg = makeGroupMessage('mira https://chat.whatsapp.com/abc');

      fireUpsert(fire, msg);
      await flush();

      expect(sock.sendMessage).toHaveBeenCalledWith(GROUP_JID, { delete: msg.key });
      expect(sock.sendMessage).toHaveBeenCalledWith(
        GROUP_JID,
        expect.objectContaining({ text: expect.stringContaining('chat.whatsapp.com') }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });

    it('kicks the sender on kick mode when the bot is group admin', async () => {
      mockGetBlockedLinkInfo.mockReturnValue({ ...blockedResult, action: 'kick' });
      mockGetBotPermissions.mockResolvedValue({ isAdmin: true, isSuperAdmin: false });
      const { fire, sock } = createPipeline();
      const msg = makeGroupMessage('mira https://chat.whatsapp.com/abc');

      fireUpsert(fire, msg);
      await flush();

      expect(sock.groupParticipantsUpdate).toHaveBeenCalledWith(
        GROUP_JID,
        [SENDER_JID],
        'remove',
      );
    });

    it('exempts group admins from antilink moderation', async () => {
      mockGetBlockedLinkInfo.mockReturnValue(blockedResult);
      mockGetUserPermissions.mockResolvedValue({ isAdmin: true, isOwner: false });
      const { fire, sock } = createPipeline();
      const msg = makeGroupMessage('mira https://chat.whatsapp.com/abc');

      fireUpsert(fire, msg);
      await flush();

      expect(sock.sendMessage).not.toHaveBeenCalledWith(GROUP_JID, { delete: msg.key });
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });

    it('does nothing when no link is blocked', async () => {
      const { fire, sock } = createPipeline();

      fireUpsert(fire, makeGroupMessage('hola a todos'));
      await flush();

      expect(mockGetBlockedLinkInfo).toHaveBeenCalledWith(GROUP_JID, 'hola a todos');
      expect(sock.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('chat summary buffering', () => {
    it('buffers non-command group chatter for the summary command', async () => {
      const { fire } = createPipeline();

      fireUpsert(fire, makeGroupMessage('holaa grupo'));
      await flush();

      expect(mockAddChatMessage).toHaveBeenCalledWith(GROUP_JID, 'Tester', 'holaa grupo');
    });

    it('does not buffer command messages or very short texts', async () => {
      const { fire } = createPipeline();
      registerCommand('pipeping');

      fireUpsert(fire, makeGroupMessage('.pipeping'));
      fireUpsert(fire, makeGroupMessage('x'));
      await flush();

      expect(mockAddChatMessage).not.toHaveBeenCalled();
    });
  });

  describe('command resolution and execution', () => {
    it('executes registry commands with the parsed command and args', async () => {
      const { fire, stats } = createPipeline();
      const { execute } = registerCommand('pipeping');
      const msg = makeMessage('.pipeping hola');

      fireUpsert(fire, msg);
      await flush();

      expect(execute).toHaveBeenCalledTimes(1);
      const ctx = execute.mock.calls[0][0] as IMessageContext;
      expect(ctx.command).toBe('pipeping');
      expect(ctx.args).toEqual(['hola']);
      expect(stats.commandsExecuted).toBe(1);
      expect(stats.errorsCount).toBe(0);
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });

    it('consumes the first argument of two-word commands', async () => {
      const { fire } = createPipeline();
      const { execute } = registerCommand('armor set');

      fireUpsert(fire, makeMessage('.armor set helmet'));
      await flush();

      expect(execute).toHaveBeenCalledTimes(1);
      const ctx = execute.mock.calls[0][0] as IMessageContext;
      expect(ctx.command).toBe('armor');
      expect(ctx.args).toEqual(['helmet']);
    });

    it('lazy-loads, registers and executes unknown commands via the plugin loader', async () => {
      const { fire } = createPipeline();
      const lazyExecute = vi.fn().mockResolvedValue(undefined);
      const lazyCommand: ICommand = {
        name: 'pipelazy',
        description: 'lazy command',
        category: CommandCategory.UTILITY,
        execute: lazyExecute,
      };
      mockGetCommand.mockResolvedValue(lazyCommand);

      fireUpsert(fire, makeMessage('.pipelazy'));
      await flush();

      expect(mockGetCommand).toHaveBeenCalledWith('pipelazy');
      expect(commandRegistry.get('pipelazy')).toBe(lazyCommand);
      expect(lazyExecute).toHaveBeenCalledTimes(1);
    });

    it('does nothing for unknown commands beyond marking them processed', async () => {
      const { fire, sock, commandMetrics } = createPipeline();
      const msg = makeMessage('.nosuchcommandxyz');

      fireUpsert(fire, msg);
      await flush();

      expect(sock.sendMessage).not.toHaveBeenCalled();
      expect(commandMetrics.size).toBe(0);
      expect(cacheManager.hasProcessedMessage(String(msg.key.id))).toBe(true);
    });

    it('passes the parallelizable flag through to the message processor', async () => {
      const { fire, messageProcessor } = createPipeline();
      registerCommand('pipepar', { parallelizable: true });

      fireUpsert(fire, makeMessage('.pipepar x'));
      await flush();

      expect(messageProcessor.process).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        true,
      );
    });

    it('loads sender and bot permissions for permission-gated commands', async () => {
      const { fire } = createPipeline();
      const senderSpy = vi.spyOn(MessageContext.prototype, 'loadSenderPermissions');
      const botSpy = vi.spyOn(MessageContext.prototype, 'loadBotPermissions');
      const { execute } = registerCommand('pipeperm', {
        permissions: { user: [PermissionLevel.ADMIN] },
      });

      try {
        fireUpsert(fire, makeGroupMessage('.pipeperm'));
        await flush();

        expect(senderSpy).toHaveBeenCalled();
        expect(botSpy).toHaveBeenCalled();
        // The permission middleware is not part of this chain, so the
        // command itself still runs after the lookups.
        expect(execute).toHaveBeenCalledTimes(1);
      } finally {
        senderSpy.mockRestore();
        botSpy.mockRestore();
      }
    });
  });

  describe('command availability gates', () => {
    it('replies and skips disabled commands', async () => {
      const { fire, sock } = createPipeline();
      const { execute } = registerCommand('pipedis', { enabled: false });

      fireUpsert(fire, makeMessage('.pipedis'));
      await flush();

      expect(execute).not.toHaveBeenCalled();
      expect(sock.sendMessage).toHaveBeenCalledWith(
        PRIVATE_JID,
        expect.objectContaining({ text: '❌ Este comando está deshabilitado.' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('blocks NSFW commands with the toggle hint when NSFW is off', async () => {
      mockNsfwEnabled.mockResolvedValue(false);
      const { fire, sock } = createPipeline();
      const { execute } = registerCommand('pipensfw', { nsfw: true });

      fireUpsert(fire, makeMessage('.pipensfw'));
      await flush();

      expect(mockNsfwEnabled).toHaveBeenCalledWith(null);
      expect(execute).not.toHaveBeenCalled();
      expect(sock.sendMessage).toHaveBeenCalledWith(
        PRIVATE_JID,
        expect.objectContaining({ text: expect.stringContaining('NSFW') }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('fails closed when the NSFW toggle service throws', async () => {
      mockNsfwEnabled.mockRejectedValue(new Error('db down'));
      const { fire, sock } = createPipeline();
      const { execute } = registerCommand('pipensfw', { nsfw: true });

      fireUpsert(fire, makeMessage('.pipensfw'));
      await flush();

      expect(execute).not.toHaveBeenCalled();
      expect(sock.sendMessage).toHaveBeenCalledWith(
        PRIVATE_JID,
        expect.objectContaining({ text: expect.stringContaining('NSFW') }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('runs NSFW commands when the toggle is enabled', async () => {
      const { fire } = createPipeline();
      const { execute } = registerCommand('pipensfw', { nsfw: true });

      fireUpsert(fire, makeMessage('.pipensfw'));
      await flush();

      expect(mockNsfwEnabled).toHaveBeenCalledWith(null);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('execution errors and metrics', () => {
    it('replies with a generic error and tracks the failure', async () => {
      const { fire, sock, stats } = createPipeline();
      const { execute } = registerCommand('pipeerr');
      execute.mockRejectedValue(new Error('boom'));

      fireUpsert(fire, makeMessage('.pipeerr'));
      await flush();

      expect(stats.errorsCount).toBe(1);
      expect(stats.commandsExecuted).toBe(0);
      expect(sock.sendMessage).toHaveBeenCalledWith(
        PRIVATE_JID,
        expect.objectContaining({ text: 'Error al ejecutar el comando.' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('replies with a timeout hint when the command exceeds the deadline', async () => {
      vi.useFakeTimers();
      const { fire, sock, stats } = createPipeline();
      const { execute } = registerCommand('pipeslow');
      execute.mockReturnValue(new Promise<void>(() => {}));

      fireUpsert(fire, makeMessage('.pipeslow'));
      await vi.advanceTimersByTimeAsync(31_000);

      expect(stats.errorsCount).toBe(1);
      expect(stats.commandsExecuted).toBe(0);
      expect(sock.sendMessage).toHaveBeenCalledWith(
        PRIVATE_JID,
        expect.objectContaining({ text: '⏱️ El comando tardó demasiado. Intenta de nuevo.' }),
        expect.objectContaining({ quoted: expect.anything() }),
      );
    });

    it('tracks per-command metrics with count, average time and errors', async () => {
      const { pipeline, fire } = createPipeline();
      const { command, execute } = registerCommand('pipemetric');

      execute.mockRejectedValueOnce(new Error('boom'));
      fireUpsert(fire, makeMessage('.pipemetric'));
      await flush();
      fireUpsert(fire, makeMessage('.pipemetric'));
      await flush();

      const metrics = pipeline.getCommandMetrics();
      const entry = metrics.find(m => m.command === command.name);

      expect(entry).toBeDefined();
      expect(entry?.count).toBe(2);
      expect(entry?.errors).toBe(1);
      expect(entry?.avgTime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(entry?.avgTime)).toBe(true);
    });
  });

  describe('middleware orchestration', () => {
    const makeMiddleware = (
      name: string,
      order: string[],
      behavior: 'pass' | 'stop' | 'noop',
    ): IMiddleware =>
      ({
        name,
        execute: async (_ctx: IMessageContext, next: () => Promise<void>) => {
          order.push(name);
          if (behavior === 'pass') await next();
        },
      }) as unknown as IMiddleware;

    it('runs the parallel batch first, then sequential middlewares, then the handler', async () => {
      const order: string[] = [];
      const middlewares: FakeMiddlewareConfig[] = [
        { middleware: makeMiddleware('par1', order, 'noop'), priority: 1, canRunParallel: true },
        { middleware: makeMiddleware('par2', order, 'noop'), priority: 1, canRunParallel: true },
        { middleware: makeMiddleware('seq1', order, 'pass'), priority: 5, canRunParallel: false },
      ];
      const { fire } = createPipeline({ middlewares });
      const { execute } = registerCommand('pipeping');

      fireUpsert(fire, makeMessage('.pipeping'));
      await flush();

      expect(order).toEqual(['par1', 'par2', 'seq1']);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('never reaches the handler when a sequential middleware does not call next', async () => {
      const order: string[] = [];
      const middlewares: FakeMiddlewareConfig[] = [
        { middleware: makeMiddleware('blocker', order, 'stop'), priority: 5, canRunParallel: false },
      ];
      const { fire, stats } = createPipeline({ middlewares });
      const { execute } = registerCommand('pipeping');

      fireUpsert(fire, makeMessage('.pipeping'));
      await flush();

      expect(order).toEqual(['blocker']);
      expect(execute).not.toHaveBeenCalled();
      expect(stats.commandsExecuted).toBe(0);
    });
  });

  describe('stats logging', () => {
    it('triggers the stats logger after the log interval has elapsed', async () => {
      const { fire, logStats, stats } = createPipeline({ lastStatsLog: 0 });
      registerCommand('pipeping');

      fireUpsert(fire, makeMessage('.pipeping'));
      await flush();

      expect(logStats).toHaveBeenCalledTimes(1);
      expect(stats.lastStatsLog).toBeGreaterThan(0);
    });

    it('does not log stats again within the interval', async () => {
      const { fire, logStats } = createPipeline();
      registerCommand('pipeping');

      fireUpsert(fire, makeMessage('.pipeping'));
      await flush();

      expect(logStats).not.toHaveBeenCalled();
    });
  });
});
