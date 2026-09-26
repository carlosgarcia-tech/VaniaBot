import type { WAMessage, WASocket } from 'baileys';
import type { SubBotConfig } from '@/types/subbot.js';
import { commandRegistry } from '@/core/CommandRegistry.js';
import { pluginLoader } from '@/core/PluginLoader.js';
import { MessageContext } from '@/core/MessageContext.js';
import { cacheManager } from '@/core/CacheManager.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { processedMessagesRepository } from '@/repositories/ProcessedMessagesRepository.js';
import { handleReaccion } from '@/handlers/ReaccionHandler.js';
import { quizAnswerHandler } from '@/handlers/QuizAnswerHandler.js';
import { handleMention } from '@/handlers/AiMentionHandler.js';
import { welcomeService } from '@/services/system/WelcomeService.js';
import { antiArabService } from '@/services/moderation/AntiArabService.js';
import { VANIA_TOGGLE_COMMANDS } from '@/config/index.js';
import { CommandExecutionError } from '@/utils/errors.js';
import { logger, logError } from '@/utils/logger.js';
import type { IMiddleware } from '@/types/index.js';
import type { BaileysEventMap } from 'baileys';
import type { AntiSpamService } from '@/services/system/AntiSpamService.js';

type GroupParticipantsUpdate = BaileysEventMap['group-participants.update'];

export interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

export class SubBotMessageHandler {
  constructor(
    private getMiddlewares: (botId: string) => MiddlewareConfig[],
    private getAntiSpam: (botId: string) => AntiSpamService | undefined,
    private markDedup: (botId: string, msg: WAMessage) => boolean,
  ) {}

  async handleMessage(msg: WAMessage, sock: WASocket, subConfig: SubBotConfig): Promise<void> {
    if (!msg?.message || msg.key.fromMe) return;

    const messageId = msg.key.id;
    if (!messageId) return;

    if (this.markDedup(subConfig.id, msg)) return;

    const lastStartup = runtimeStateRepository.getLastStartupAt(subConfig.id);
    if (lastStartup) {
      const rawTimestamp = msg.messageTimestamp;
      const msgTimestamp =
        rawTimestamp !== undefined && rawTimestamp !== null ? Number(rawTimestamp) * 1000 : 0;
      const startupTime = new Date(lastStartup).getTime();
      if (msgTimestamp > 0 && msgTimestamp < startupTime) {
        logger.debug(`[SubBot:${subConfig.id}] Skipping pre-startup message ${messageId}`);
        processedMessagesRepository.markProcessed(messageId, subConfig.id);
        return;
      }
    }

    const startTime = Date.now();

    try {
      if (msg.message?.reactionMessage) {
        await handleReaccion(sock, msg).catch(err =>
          logError(`SubBot[${subConfig.id}].handleReaccion`, err),
        );
        return;
      }

      const toggleBotId = `subbot${subConfig.slot}`;
      const ctx = new MessageContext(sock, msg, toggleBotId);

      const isVaniaToggleCommand = VANIA_TOGGLE_COMMANDS.includes(ctx.command);

      if (isVaniaToggleCommand && !ctx.args[0]) {
        logger.debug(`📤 SubBot[${subConfig.id}] skipping non-slot toggle command: ${ctx.command}`);
        return;
      }

      if (ctx.chat.isGroup) {
        const isEnabled = await serviceManager.vaniaToggleService.isAllowedForSubbot(
          ctx.chat.jid,
          toggleBotId,
          ctx.command,
        );
        if (!isEnabled) return;
      }

      if (ctx.chat.isGroup) {
        const isMuted = await serviceManager.moderationService.isMuted(
          ctx.chat.jid,
          ctx.sender.jid,
        );

        if (isMuted) {
          if (ctx.chat.isBotAdmin) {
            try {
              await sock.sendMessage(ctx.chat.jid, { delete: msg.key });
            } catch (error) {
              logError('[MUTE] Error al eliminar mensaje en SubBot', error);
            }
          }
          return;
        }
      }

      if (ctx.chat.isGroup && !ctx.command) {
        const quizHandled = await quizAnswerHandler.handle(ctx);
        if (quizHandled) return;
        const botJid = sock.user?.id ?? '';
        await handleMention(ctx, botJid);
        return;
      }

      if (!ctx.command) return;

      const antiSpam = this.getAntiSpam(subConfig.id);
      if (antiSpam) {
        const rateLimit = antiSpam.check(ctx.sender.jid);
        if (!rateLimit.allowed) {
          await ctx
            .reply(rateLimit.reason ?? '⚠️ Demasiados mensajes')
            .catch((error: unknown) => logError('[SubBotMessageHandler]', error));
          return;
        }
      }

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

      if (!command) return;

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

      const middlewares = this.getMiddlewares(subConfig.id);
      await this.executeWithMiddlewares(ctx, middlewares, async () => {
        try {
          await command.execute(ctx);
          const processingTime = Date.now() - startTime;
          logger.info(`✅ SubBot[${subConfig.id}] cmd=${ctx.command} time=${processingTime}ms`);
          if (processingTime > 2000) {
            logger.warn(`⚠️ SubBot[${subConfig.id}] ${ctx.command}: ${processingTime}ms (lento)`);
          }
        } catch (error) {
          logError(`SubBot[${subConfig.id}]`, new CommandExecutionError(ctx.command, error));
          await ctx
            .reply('Ocurrió un error al ejecutar el comando 💔')
            .catch((error: unknown) => logError('[SubBotMessageHandler]', error));
        }
      });

      cacheManager.markMessageProcessed(messageId);
    } catch (error) {
      logError(`SubBot[${subConfig.id}].handleMessage`, error);
    }
  }

  async handleGroupUpdate(
    update: GroupParticipantsUpdate,
    sock: WASocket,
    botId: string,
  ): Promise<void> {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !participants) return;
    try {
      cacheManager.invalidateGroupMetadata(groupJid);
      await serviceManager.groupService.getGroup(groupJid);
      const isEnabled = await serviceManager.vaniaToggleService.isEnabled(groupJid, botId);
      if (!isEnabled) return;

      if (action === 'add') {
        for (const participant of participants) {
          const participantId = typeof participant === 'string' ? participant : participant.id;
          if (participantId) {
            welcomeService
              .handleNewParticipant(sock, groupJid, participantId)
              .catch(err => logError('SubBot.handleNewParticipant', err));
          }
        }
      }

      if (action === 'remove') {
        for (const participant of participants) {
          const participantId = typeof participant === 'string' ? participant : participant.id;
          if (participantId) {
            welcomeService
              .handleParticipantLeft(sock, groupJid, participantId, botId)
              .catch(err => logError('SubBot.handleParticipantLeft', err));
          }
        }
      }

      await this.handleAntiArab(sock, groupJid, action, participants);
    } catch (error) {
      logError('SubBot.handleGroupUpdate', error);
    }
  }

  /** Kicks new participants matching per-group blocked prefixes (AntiArab). */
  private async handleAntiArab(
    sock: WASocket,
    groupJid: string,
    action: string,
    participants: GroupParticipantsUpdate['participants'],
  ): Promise<void> {
    if (action !== 'add') return;
    if (!antiArabService.isEnabled(groupJid)) return;

    const botNumber = (sock.user?.id || '').split('@')[0].replace(/[^\d]/g, '');

    for (const participant of participants) {
      const participantId = typeof participant === 'string' ? participant : participant.id;
      if (!participantId) continue;

      const number = participantId.replace(/@.*$/, '').replace(/[^\d]/g, '');
      if (!number || number === botNumber) continue;

      if (antiArabService.shouldBlockNumber(number)) {
        try {
          await sock.groupParticipantsUpdate(groupJid, [participantId], 'remove');
          logger.info(`AntiArab: Usuario ${number} removido del grupo ${groupJid}`);
        } catch (error) {
          logger.error(`AntiArab: Error al remover usuario ${number}`, error);
        }
      }
    }
  }

  private async executeWithMiddlewares(
    ctx: MessageContext,
    middlewares: MiddlewareConfig[],
    handler: () => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      const parallelBatch: IMiddleware[] = [];
      while (index < middlewares.length && middlewares[index].canRunParallel) {
        parallelBatch.push(middlewares[index].middleware);
        index++;
      }
      if (parallelBatch.length > 0) {
        await Promise.all(parallelBatch.map(mw => mw.execute(ctx, async () => {})));
      }
      if (index < middlewares.length) {
        const cfg = middlewares[index++];
        try {
          await cfg.middleware.execute(ctx, next);
        } catch (error) {
          logError(`SubBot.Middleware:${cfg.middleware.name}`, error);
          throw error;
        }
      } else {
        await handler();
      }
    };
    await next();
  }
}
