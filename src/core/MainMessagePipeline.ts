import type { WASocket, WAMessage } from 'baileys';
import { mediaGroupBuffer } from './MediaGroupBuffer.js';
import { commandRegistry } from './CommandRegistry.js';
import { pluginLoader } from './PluginLoader.js';
import { MessageContext } from './MessageContext.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { CommandExecutionError } from '@/utils/errors.js';
import { matchCommandPrefix } from '@/utils/prefix.js';
import { cacheManager } from '@/core/CacheManager.js';
import type { AntiSpamService } from '@/services/system/AntiSpamService.js';
import { handleReaccion } from '@/handlers/ReaccionHandler.js';
import { quizAnswerHandler } from '@/handlers/QuizAnswerHandler.js';
import { handleMention } from '@/handlers/AiMentionHandler.js';
import { handleAudioResponse } from '@/handlers/AudioResponseHandler.js';
import type { IMiddleware } from '@/types/index.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';
import { withTimeout } from '@/services/system/RetryService.js';
import { persistenceService } from '@/services/system/PersistenceService.js';
import { antiDeleteService } from '@/services/system/AntiDeleteService.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { processedMessagesRepository } from '@/repositories/ProcessedMessagesRepository.js';
import { middlewareCache } from '@/middlewares/MiddlewareCache.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import { antilinkService } from '@/services/moderation/AntilinkService.js';
import { chatSummaryService } from '@/services/chat/ChatSummaryService.js';
import type { RealTimeMessageProcessor } from './RealTimeMessageProcessor.js';

interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

const COMMAND_TIMEOUT_MS = 30000;
const STATS_LOG_INTERVAL_MS = 300000;

interface PipelineStats {
  messagesReceived: number;
  messagesProcessed: number;
  commandsExecuted: number;
  errorsCount: number;
  spamBlocked: number;
  totalProcessingTime: number;
  lastStatsLog: number;
}

/** Outcome of the per-message guard checks that can short-circuit processing. */
enum GuardResult {
  Continue,
  Stop,
}

export class MainMessagePipeline {
  constructor(
    private sock: WASocket,
    private middlewares: MiddlewareConfig[],
    private antiSpam: AntiSpamService,
    private messageProcessor: RealTimeMessageProcessor,
    private stats: PipelineStats,
    private commandMetrics: Map<string, { count: number; totalTime: number; errors: number }>,
    private mainBotId: string | null,
    private logStats: () => void,
  ) {}

  registerListeners(): void {
    this.sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        const senderJid = msg.key.participant ?? msg.key.remoteJid ?? '';
        if (senderJid && msg.pushName) contactsCache.set(senderJid, msg.pushName);

        const chatJid = msg.key.remoteJid ?? '';
        if (chatJid.endsWith('@g.us')) {
          contactsCache
            .warmGroup(this.sock, chatJid)
            .catch((error: unknown) => logError('[MainMessagePipeline]', error));
        }

        if (msg.message?.imageMessage) {
          mediaGroupBuffer.add(chatJid, senderJid, msg);
        }

        if (msg.message?.reactionMessage) {
          handleReaccion(this.sock, msg).catch(err => logError('handleReaccion', err));
          continue;
        }
        handleAudioResponse(this.sock, msg).catch(err => logError('handleAudioResponse', err));
        antiDeleteService
          .storeMessage(this.sock, msg)
          .catch((error: unknown) => logError('[MainMessagePipeline]', error));
        this.handleMessage(msg);
      }
    });

    this.sock.ev.on('connection.update', update => {
      if (update.connection === 'open' && this.sock.user?.id) {
        this.mainBotId = this.sock.user.id;
        runtimeStateRepository.setStartupTimestamp(this.mainBotId);
        // Re-schedule persisted reminders/polls now that we have a live socket.
        persistenceService.setSocket(this.sock);
        logger.info(`[Client] Set startup timestamp for ${this.mainBotId}`);
      }
    });

    this.sock.ev.on('groups.update', updates => {
      for (const update of updates) {
        if (update.id) cacheManager.invalidateGroupMetadata(update.id);
      }
    });
  }

  /**
   * Entry point for every message. Cheap synchronous filters run inline;
   * the rest is dispatched through the message processor (dedupe +
   * sequential/parallel scheduling) inside a microtask.
   */
  private handleMessage(message: WAMessage): void {
    if (!this.isProcessableMessage(message)) return;
    const messageId = message.key.id as string;

    if (this.isPreStartupEcho(message)) {
      processedMessagesRepository.markProcessed(messageId, this.mainBotId as string);
      cacheManager.markMessageProcessed(messageId);
      return;
    }

    const parallelizable = this.isParallelizableCommand(message);
    this.stats.messagesReceived++;

    queueMicrotask(() => {
      void (async () => {
        const startTime = Date.now();
        await this.messageProcessor.process(
          messageId,
          async () => {
            try {
              const ctx = new MessageContext(this.sock, message, 'main');

              const stop = await this.runGuards(ctx, messageId);
              if (stop) return;

              if (!ctx.command) {
                cacheManager.markMessageProcessed(messageId);
                return;
              }

              if (!this.checkRateLimits(ctx)) return;

              await this.resolveAndExecute(ctx, messageId, startTime);
            } catch (error) {
              logError('handleMessageRealTime', error);
            }
          },
          parallelizable,
        );
        this.maybeLogStats();
      })();
    });
  }

  /** Cheap synchronous validity checks. */
  private isProcessableMessage(message: WAMessage): boolean {
    if (!message?.message || message.key.fromMe) return false;
    const messageId = message.key.id;
    if (!messageId) return false;
    if (cacheManager.hasProcessedMessage(messageId)) return false;
    return true;
  }

  /**
   * True for messages timestamped before the bot's last startup — offline
   * echoes that must not be re-processed.
   */
  private isPreStartupEcho(message: WAMessage): boolean {
    if (!this.mainBotId) return false;
    const lastStartup = runtimeStateRepository.getLastStartupAt(this.mainBotId);
    if (!lastStartup) return false;

    const rawTimestamp = message.messageTimestamp;
    const msgTimestamp =
      rawTimestamp !== undefined && rawTimestamp !== null ? Number(rawTimestamp) * 1000 : 0;
    const startupTime = new Date(lastStartup).getTime();
    return msgTimestamp > 0 && msgTimestamp < startupTime;
  }

  private isParallelizableCommand(message: WAMessage): boolean {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const matchedPrefix = matchCommandPrefix(text);
    if (matchedPrefix === undefined) return false;

    const commandRest = text.slice(matchedPrefix.length);
    const commandName = commandRest.split(' ')[0]?.toLowerCase() ?? '';
    const fullCommandName = commandRest.toLowerCase();
    const cmd = commandRegistry.get(fullCommandName) || commandRegistry.get(commandName);
    return cmd?.parallelizable || false;
  }

  /**
   * Sequential guard chain run before command resolution. Each guard can
   * short-circuit processing (mute, vania toggle, quiz/mention interception).
   */
  private async runGuards(ctx: MessageContext, messageId: string): Promise<GuardResult> {
    if (ctx.chat.isGroup) {
      if (await this.handleMutedUser(ctx, messageId)) return GuardResult.Stop;
      if (await this.handleVaniaToggle(ctx, messageId)) return GuardResult.Stop;
      if (await this.handleAntilink(ctx, messageId)) return GuardResult.Stop;
      if (!ctx.command) {
        // Buffer non-command group chatter for !resumirchat (chat summary).
        if (ctx.text.length >= 2 && !this.isPrefixed(ctx.text)) {
          chatSummaryService.addMessage(ctx.chat.jid, ctx.sender.pushName || 'User', ctx.text);
        }
        if (await this.handleGroupConversation(ctx, messageId)) return GuardResult.Stop;
      }
    }

    if (!ctx.command) {
      cacheManager.markMessageProcessed(messageId);
      return GuardResult.Stop;
    }

    return GuardResult.Continue;
  }

  /** True when the text starts with any configured command prefix. */
  private isPrefixed(text: string): boolean {
    return matchCommandPrefix(text) !== undefined;
  }

  /**
   * Per-group antilink moderation (delete/kick). Runs before command
   * resolution so it also covers plain messages. Replaces the dead
   * AntilinkMiddleware that was never registered in any pipeline. Owners
   * and group admins are exempt; commands go through the permission
   * chain anyway, so only their text is inspected here.
   */
  private async handleAntilink(ctx: MessageContext, messageId: string): Promise<boolean> {
    if (!ctx.text || typeof ctx.text !== 'string') return false;
    if (ctx.sender.isOwner) return false;

    const checkResult = antilinkService.getBlockedLinkInfo(ctx.chat.jid, ctx.text);
    if (!checkResult.blocked) return false;

    // Exempt group admins (permission lookup is LRU-cached, so this is cheap
    // and only runs for messages that actually contain a blocked link).
    await ctx.loadSenderPermissions();
    if (ctx.sender.isAdmin) return false;

    try {
      if (checkResult.action === 'kick' && ctx.chat.isBotAdmin) {
        const senderJid = ctx.message.key.participant ?? null;
        if (senderJid) {
          await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [senderJid], 'remove');
          await ctx.reply(
            `Enlace bloqueado: *${checkResult.link?.domain || checkResult.link?.raw}*\nExpulsado automáticamente.`,
          );
          cacheManager.markMessageProcessed(messageId);
          return true;
        }
      }
      await ctx.sock.sendMessage(ctx.chat.jid, { delete: ctx.message.key });
      await ctx.reply(`Enlace bloqueado: *${checkResult.link?.domain || checkResult.link?.raw}*`);
    } catch (error) {
      logError('[Antilink]', error);
    }
    cacheManager.markMessageProcessed(messageId);
    return true;
  }

  /** Deletes non-command messages from muted users; true when handled. */
  private async handleMutedUser(ctx: MessageContext, messageId: string): Promise<boolean> {
    await ctx.loadBotPermissions();

    const muteCacheKey = `${ctx.chat.jid}:${ctx.sender.jid}`;
    const mutedCached = middlewareCache.userMuted.get<{ value: boolean }>(muteCacheKey);
    if (mutedCached?.value !== true) return false;

    if (ctx.chat.isBotAdmin) {
      try {
        await ctx.sock.sendMessage(ctx.chat.jid, { delete: ctx.message.key });
      } catch (err) {
        logError('[MUTE] Error eliminando mensaje normal', err);
      }
    }
    cacheManager.markMessageProcessed(messageId);
    return true;
  }

  /**
   * Applies the per-chat vania toggle via the shared guard in
   * VaniaToggleService. Bare toggle commands pass through (the main bot
   * executes them against itself); slot-addressed toggles are swallowed
   * here (the subbot instance handles them via its own socket) and
   * everything else in a disabled chat is dropped. Returns true when the
   * message was handled (stop processing).
   */
  private async handleVaniaToggle(ctx: MessageContext, messageId: string): Promise<boolean> {
    const allowed = await serviceManager.vaniaToggleService.isAllowedForMain(
      ctx.chat.jid,
      ctx.command,
      ctx.args,
    );

    if (allowed) return false;

    cacheManager.markMessageProcessed(messageId);
    return true;
  }

  /** Routes non-command group chatter to quiz answers or AI mention handling. */
  private async handleGroupConversation(ctx: MessageContext, messageId: string): Promise<boolean> {
    const quizHandled = await quizAnswerHandler.handle(ctx);
    if (quizHandled) {
      cacheManager.markMessageProcessed(messageId);
      return true;
    }
    const botJid = this.sock.user?.id ?? '';
    await handleMention(ctx, botJid);
    cacheManager.markMessageProcessed(messageId);
    return true;
  }

  /** Anti-spam / anti-flood / group-load checks. False when blocked. */
  private checkRateLimits(ctx: MessageContext): boolean {
    const rateLimit = this.antiSpam.check(ctx.sender.jid);
    if (!rateLimit.allowed) {
      this.stats.spamBlocked++;
      void ctx
        .reply(rateLimit.reason ?? '⚠️ Demasiados mensajes')
        .catch((error: unknown) => logError('[MainMessagePipeline]', error));
      return false;
    }

    if (ctx.chat.isGroup) {
      const floodCheck = rateLimitService.checkFlood(ctx.sender.jid);
      if (!floodCheck.allowed) {
        this.stats.spamBlocked++;
        void ctx
          .reply(floodCheck.reason ?? '⚠️ Estás escribiendo muy rápido')
          .catch((error: unknown) => logError('[MainMessagePipeline]', error));
        return false;
      }
      const groupRateLimit = rateLimitService.checkGroupRateLimit(ctx.chat.jid);
      if (!groupRateLimit.allowed) {
        this.stats.spamBlocked++;
        void ctx
          .reply(groupRateLimit.reason ?? '⚠️ El grupo está muy activo')
          .catch((error: unknown) => logError('[MainMessagePipeline]', error));
        return false;
      }
    }

    return true;
  }

  /** Resolves the command (registry → lazy plugin) and runs the full chain. */
  private async resolveAndExecute(
    ctx: MessageContext,
    messageId: string,
    startTime: number,
  ): Promise<void> {
    const fullCommand = ctx.args.length > 0 ? `${ctx.command} ${ctx.args[0]}` : null;
    let command =
      (fullCommand ? commandRegistry.get(fullCommand) : null) ?? commandRegistry.get(ctx.command);

    if (!command) {
      const lazyCmd = await pluginLoader.getCommand(ctx.command);
      if (lazyCmd) {
        commandRegistry.register(lazyCmd);
        command = lazyCmd;
      }
    }

    if (!command) {
      logger.warn(`❌ Command not found in registry: ${ctx.command}`);
      cacheManager.markMessageProcessed(messageId);
      return;
    }

    // Two-word command (e.g. "armor set") consumed its first arg.
    if (fullCommand && commandRegistry.get(fullCommand)) {
      ctx.args = ctx.args.slice(1);
    }

    if (command.permissions?.user || command.permissions?.bot) {
      if (ctx.chat.isGroup) {
        await Promise.all([ctx.loadSenderPermissions(), ctx.loadBotPermissions()]);
      } else {
        await ctx.loadSenderPermissions();
      }
    }
    await this.executeWithMiddlewares(ctx, async () => {
      const allowed = await this.checkCommandAvailability(ctx, command);
      if (!allowed) return;
      await this.runCommand(ctx, command);
    });

    cacheManager.markMessageProcessed(messageId);
    const processingTime = Date.now() - startTime;
    this.stats.totalProcessingTime += processingTime;
    if (processingTime > 500) logger.warn(`⚠️ ${ctx.command}: ${processingTime}ms`);
  }

  /** Enabled/NSFW gates. False when the command must not run. */
  private async checkCommandAvailability(
    ctx: MessageContext,
    command: NonNullable<ReturnType<typeof commandRegistry.get>>,
  ): Promise<boolean> {
    if (command.enabled === false) {
      await ctx
        .reply('❌ Este comando está deshabilitado.')
        .catch((error: unknown) => logError('[MainMessagePipeline]', error));
      return false;
    }

    if (command.nsfw === true) {
      const nsfwAllowed = await serviceManager.nsfwToggleService
        .isEnabled(ctx.chat.isGroup ? ctx.chat.jid : null)
        .catch((error: unknown) => {
          logError('[MainMessagePipeline] nsfwToggleService', error);
          return false; // fail closed
        });
      if (!nsfwAllowed) {
        await ctx
          .reply('🔞 Los comandos NSFW están deshabilitados.\nUsa !nsfw on para habilitar.')
          .catch((error: unknown) => logError('[MainMessagePipeline]', error));
        return false;
      }
    }

    return true;
  }

  private async runCommand(
    ctx: MessageContext,
    command: NonNullable<ReturnType<typeof commandRegistry.get>>,
  ): Promise<void> {
    const cmdStartTime = Date.now();
    try {
      await withTimeout(
        command.execute(ctx),
        COMMAND_TIMEOUT_MS,
        `Command ${command.name} timed out after ${COMMAND_TIMEOUT_MS}ms`,
      );
      this.stats.commandsExecuted++;
      this.trackCommandMetric(command.name, Date.now() - cmdStartTime, false);
    } catch (error) {
      this.stats.errorsCount++;
      this.trackCommandMetric(command.name, Date.now() - cmdStartTime, true);
      if (error instanceof Error && error.message.includes('timed out')) {
        logger.error(`⏱️ Command ${command.name} timed out`);
        await ctx
          .reply('⏱️ El comando tardó demasiado. Intenta de nuevo.')
          .catch((err: unknown) => logError('[MainMessagePipeline]', err));
      } else {
        logError('Command', new CommandExecutionError(ctx.command, error));
        await ctx
          .reply('Error al ejecutar el comando.')
          .catch((err: unknown) => logError('[MainMessagePipeline]', err));
      }
    }
  }

  private maybeLogStats(): void {
    if (Date.now() - this.stats.lastStatsLog > STATS_LOG_INTERVAL_MS) {
      this.logStats();
      this.stats.lastStatsLog = Date.now();
    }
  }

  private async executeWithMiddlewares(
    ctx: MessageContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      const parallelBatch: IMiddleware[] = [];
      while (index < this.middlewares.length && this.middlewares[index].canRunParallel) {
        parallelBatch.push(this.middlewares[index].middleware);
        index++;
      }
      if (parallelBatch.length > 0) {
        await Promise.all(parallelBatch.map(mw => mw.execute(ctx, async () => {})));
      }
      if (index < this.middlewares.length) {
        const config = this.middlewares[index++];
        try {
          await config.middleware.execute(ctx, next);
        } catch (error) {
          logError(`Middleware:${config.middleware.name}`, error);
          throw error;
        }
      } else {
        await handler();
      }
    };
    await next();
  }

  private trackCommandMetric(name: string, time: number, error: boolean): void {
    const existing = this.commandMetrics.get(name) || { count: 0, totalTime: 0, errors: 0 };
    this.commandMetrics.set(name, {
      count: existing.count + 1,
      totalTime: existing.totalTime + time,
      errors: existing.errors + (error ? 1 : 0),
    });
  }

  getCommandMetrics(): Array<{ command: string; count: number; avgTime: number; errors: number }> {
    return Array.from(this.commandMetrics.entries()).map(([command, data]) => ({
      command,
      count: data.count,
      avgTime: Math.round(data.totalTime / data.count),
      errors: data.errors,
    }));
  }
}
