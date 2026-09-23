import type { WASocket, WAMessage } from 'baileys';
import { mediaGroupBuffer } from './MediaGroupBuffer.js';
import { commandRegistry } from './CommandRegistry.js';
import { pluginLoader } from './PluginLoader.js';
import { MessageContext } from './MessageContext.js';
import { config, VANIA_TOGGLE_COMMANDS } from '@/config/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { CommandExecutionError } from '@/utils/errors.js';
import { cacheManager } from '@/core/CacheManager.js';
import type { AntiSpamService } from '@/services/system/AntiSpamService.js';
import { handleReaccion } from '@/handlers/ReaccionHandler.js';
import { quizAnswerHandler } from '@/handlers/QuizAnswerHandler.js';
import { handleMention } from '@/handlers/AiMentionHandler.js';
import { handleAudioResponse } from '@/handlers/AudioResponseHandler.js';
import type { IMiddleware } from '@/types/index.js';
import { CommandCategory } from '@/types/index.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';
import { withTimeout } from '@/services/system/RetryService.js';
import { persistenceService } from '@/services/system/PersistenceService.js';
import { antiDeleteService } from '@/services/system/AntiDeleteService.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { processedMessagesRepository } from '@/repositories/ProcessedMessagesRepository.js';
import { middlewareCache } from '@/middlewares/MiddlewareCache.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import type { RealTimeMessageProcessor } from './RealTimeMessageProcessor.js';

interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

const COMMAND_TIMEOUT_MS = 30000;

interface PipelineStats {
  messagesReceived: number;
  messagesProcessed: number;
  commandsExecuted: number;
  errorsCount: number;
  spamBlocked: number;
  totalProcessingTime: number;
  lastStatsLog: number;
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

  private handleMessage(message: WAMessage): void {
    if (!message?.message || message.key.fromMe) return;
    const messageId = message.key.id;
    if (!messageId) return;
    if (cacheManager.hasProcessedMessage(messageId)) return;

    if (this.mainBotId) {
      const lastStartup = runtimeStateRepository.getLastStartupAt(this.mainBotId);
      if (lastStartup) {
        const rawTimestamp = message.messageTimestamp;
        const msgTimestamp =
          rawTimestamp !== undefined && rawTimestamp !== null ? Number(rawTimestamp) * 1000 : 0;
        const startupTime = new Date(lastStartup).getTime();
        if (msgTimestamp > 0 && msgTimestamp < startupTime) {
          processedMessagesRepository.markProcessed(messageId, this.mainBotId);
          cacheManager.markMessageProcessed(messageId);
          return;
        }
      }
    }

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    // Match the longest configured prefix first so multi-char prefixes
    // (e.g. '..') are not swallowed by shorter ones ('.').
    const prefixes = [config.prefix, '.', '!']
      .filter((p, i, arr): p is string => Boolean(p) && arr.indexOf(p) === i)
      .sort((a, b) => b.length - a.length);
    const matchedPrefix = prefixes.find(p => text.startsWith(p));
    const isCommand = matchedPrefix !== undefined;
    const commandRest = matchedPrefix ? text.slice(matchedPrefix.length) : '';
    const commandName = commandRest.split(' ')[0]?.toLowerCase() ?? '';
    const fullCommandName = matchedPrefix ? commandRest.toLowerCase() : null;
    let isParallelizable = false;
    if (isCommand && fullCommandName) {
      const cmd = commandRegistry.get(fullCommandName) || commandRegistry.get(commandName);
      isParallelizable = cmd?.parallelizable || false;
    }
    this.stats.messagesReceived++;
    queueMicrotask(() => {
      void (async () => {
        const startTime = Date.now();
        await this.messageProcessor.process(
          messageId,
          async () => {
            try {
              const ctx = new MessageContext(this.sock, message, 'main');

              if (ctx.chat.isGroup) {
                await ctx.loadBotPermissions();

                const muteCacheKey = `${ctx.chat.jid}:${ctx.sender.jid}`;
                const mutedCached = middlewareCache.userMuted.get<{ value: boolean }>(muteCacheKey);
                if (mutedCached?.value === true) {
                  if (ctx.chat.isBotAdmin) {
                    try {
                      await ctx.sock.sendMessage(ctx.chat.jid, { delete: ctx.message.key });
                    } catch (err) {
                      logError('[MUTE] Error eliminando mensaje normal', err);
                    }
                  }
                  cacheManager.markMessageProcessed(messageId);
                  return;
                }
              }

              if (ctx.chat.isGroup) {
                const isVaniaToggleCommand = VANIA_TOGGLE_COMMANDS.includes(ctx.command);
                if (isVaniaToggleCommand && ctx.args[0]) {
                  const slotNum = parseInt(ctx.args[0]);
                  if (!isNaN(slotNum) && slotNum > 0) {
                    cacheManager.markMessageProcessed(messageId);
                    return;
                  }
                }
                if (!isVaniaToggleCommand) {
                  try {
                    const isEnabled = await serviceManager.vaniaToggleService.isEnabled(
                      ctx.chat.jid,
                      'main',
                    );
                    if (!isEnabled) {
                      cacheManager.markMessageProcessed(messageId);
                      return;
                    }
                  } catch (error) {
                    logError('[MainMessagePipeline]', error);
                  }
                }
              }

              if (ctx.chat.isGroup && !ctx.command) {
                const quizHandled = await quizAnswerHandler.handle(ctx);
                if (quizHandled) {
                  cacheManager.markMessageProcessed(messageId);
                  return;
                }
                const botJid = this.sock.user?.id ?? '';
                await handleMention(ctx, botJid);
                cacheManager.markMessageProcessed(messageId);
                return;
              }

              if (!ctx.command) {
                cacheManager.markMessageProcessed(messageId);
                return;
              }

              const rateLimit = this.antiSpam.check(ctx.sender.jid);
              if (!rateLimit.allowed) {
                this.stats.spamBlocked++;
                await ctx
                  .reply(rateLimit.reason ?? '⚠️ Demasiados mensajes')
                  .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                return;
              }

              if (ctx.chat.isGroup) {
                const floodCheck = rateLimitService.checkFlood(ctx.sender.jid);
                if (!floodCheck.allowed) {
                  this.stats.spamBlocked++;
                  await ctx
                    .reply(floodCheck.reason ?? '⚠️ Estás escribiendo muy rápido')
                    .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                  return;
                }
                const groupRateLimit = rateLimitService.checkGroupRateLimit(ctx.chat.jid);
                if (!groupRateLimit.allowed) {
                  this.stats.spamBlocked++;
                  await ctx
                    .reply(groupRateLimit.reason ?? '⚠️ El grupo está muy activo')
                    .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                  return;
                }
              }

              const fullCommand = ctx.args.length > 0 ? `${ctx.command} ${ctx.args[0]}` : null;
              let command =
                (fullCommand ? commandRegistry.get(fullCommand) : null) ??
                commandRegistry.get(ctx.command);

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
                const cmdStartTime = Date.now();
                if (command.enabled === false) {
                  const isNsfwCommand = command.category === CommandCategory.ANIME;
                  if (isNsfwCommand) {
                    const { NsfwToggleCommand } =
                      await import('../commands/owner/NsfwToggleCommand.js');
                    if (!NsfwToggleCommand.isEnabled()) {
                      await ctx
                        .reply(
                          '🔞 Los comandos NSFW están deshabilitados.\nUsa !nsfw on para habilitar.',
                        )
                        .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                      return;
                    }
                  } else {
                    await ctx
                      .reply('❌ Este comando está deshabilitado.')
                      .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                    return;
                  }
                }
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
                      .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                  } else {
                    logError('Command', new CommandExecutionError(ctx.command, error));
                    await ctx
                      .reply('Error al ejecutar el comando.')
                      .catch((error: unknown) => logError('[MainMessagePipeline]', error));
                  }
                }
              });

              cacheManager.markMessageProcessed(messageId);
              const processingTime = Date.now() - startTime;
              this.stats.totalProcessingTime += processingTime;
              if (processingTime > 500) logger.warn(`⚠️ ${ctx.command}: ${processingTime}ms`);
            } catch (error) {
              logError('handleMessageRealTime', error);
            }
          },
          isParallelizable,
        );
        if (Date.now() - this.stats.lastStatsLog > 300000) {
          this.logStats();
          this.stats.lastStatsLog = Date.now();
        }
      })();
    });
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
