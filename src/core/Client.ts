/**
 * Client.ts
 *
 * Composition root for the main WhatsApp session.
 *
 * Responsibilities:
 * - Bootstraps services and the command registry before any socket exists.
 * - Builds the ordered middleware chain and hands it to MainMessagePipeline.
 * - Owns the socket lifecycle (including full recreation on auth loss).
 * - Aggregates runtime metrics (queue depth, cache hit rate, per-command timings)
 *   and performs an ordered, best-effort shutdown.
 *
 * It deliberately contains no command or message logic: message handling lives
 * in MainMessagePipeline, which is re-instantiated whenever the socket is
 * recreated so listeners are never registered twice.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { WASocket } from 'baileys';
import { commandRegistry } from './CommandRegistry.js';
import { pluginLoader } from './PluginLoader.js';
import { AuthManager } from './AuthManager.js';
import { CooldownMiddleware } from '@/middlewares/CooldownMiddleware.js';
import { RegistrationMiddleware } from '@/middlewares/RegistrationMiddleware.js';
import { ValidationMiddleware } from '@/middlewares/ValidationMiddleware.js';
import { PermissionMiddleware } from '@/middlewares/PermissionMiddleware.js';
import { LoggerMiddleware } from '@/middlewares/LoggerMiddleware.js';
import { AntiSpamMiddleware } from '@/middlewares/AntiSpamMiddleware.js';
import { MuteMiddleware } from '@/middlewares/MuteMiddleware.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';
import { cacheManager } from '@/core/CacheManager.js';
import { mediaGroupBuffer } from '@/core/MediaGroupBuffer.js';
import { AntiSpamService } from '@/services/system/AntiSpamService.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';
import { listaManager } from '@/services/game/ListaManager.js';
import { PinVerificationMiddleware } from '@/middlewares/PinVerificationMiddleware.js';
import { RealTimeMessageProcessor } from './RealTimeMessageProcessor.js';
import { MainMessagePipeline } from './MainMessagePipeline.js';
import { clientEventHandlers } from './ClientEventHandlers.js';
import type { IMiddleware } from '@/types/index.js';

declare global {
  var client: WhatsAppClient | undefined;
}

/**
 * Entry in the middleware chain.
 *
 * `priority` orders execution (lower runs first) and `canRunParallel` marks
 * middlewares that are pure observers: the pipeline batches consecutive
 * parallel ones and awaits them together, so they must never call `next()`
 * to stop the chain themselves.
 */
interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

/**
 * Resolves a profile picture URL, tolerating the LID/PN duality.
 *
 * WhatsApp may identify a user by phone number or by LID, and each identifier
 * can only be resolved for one of the two. This tries the identifier as given,
 * then the paired form, returning the first URL that resolves.
 */
async function resolveProfilePicture(sock: WASocket, jid: string): Promise<string | null> {
  const candidates: string[] = [jid];

  if (jid.includes('@lid')) {
    const phone = jid.split('@')[0].split(':')[0];
    candidates.push(`${phone}@s.whatsapp.net`);
  } else if (jid.includes(':')) {
    const phone = jid.split(':')[0];
    candidates.push(`${phone}@s.whatsapp.net`);
    candidates.push(`${phone}@lid`);
  }

  for (const candidate of candidates) {
    try {
      const pic = await sock.profilePictureUrl(candidate, 'image');
      if (pic) return pic;
    } catch {
      logger.debug(`No profile picture for ${candidate}`);
    }
  }

  return null;
}

export class WhatsAppClient {
  /** Live socket; replaced wholesale on every (re)connection. */
  private sock!: WASocket;
  /** Resolved only after `initialize()` completes. */
  private readonly middlewares: MiddlewareConfig[] = [];
  private readonly authManager: AuthManager;
  private isReady = false;
  private messageProcessor = new RealTimeMessageProcessor();
  private antiSpam = new AntiSpamService();
  private maintenanceTimer: ReturnType<typeof setInterval> | null = null;
  private stats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    commandsExecuted: 0,
    errorsCount: 0,
    spamBlocked: 0,
    totalProcessingTime: 0,
    lastStatsLog: Date.now(),
  };
  private commandMetrics = new Map<string, { count: number; totalTime: number; errors: number }>();
  private mainBotId: string | null = null;
  private pipeline!: MainMessagePipeline;

  constructor() {
    this.authManager = new AuthManager();
    this.messageProcessor.on('processed', () => {
      this.stats.messagesProcessed++;
    });
    this.messageProcessor.on('error', (id: string, error: unknown) => {
      this.stats.errorsCount++;
      logError(`Message ${id}`, error);
    });
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();
    await Promise.all([
      serviceManager.initialize(),
      pluginLoader.loadCommands().then(commands => {
        for (const cmd of commands) {
          if (cmd?.name) {
            commandRegistry.register(cmd);
          }
        }
      }),
    ]);

    const { listaManager } = await import('@/services/game/ListaManager.js');
    await listaManager.initialize();

    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Servicios: ${Date.now() - startTime}ms`);
      logger.info(`Comandos: ${commandRegistry.size}`);
    }

    try {
      const { aiService } = await import('@/services/external/AIService.js');
      await aiService.initialize();
    } catch {
      logger.warn('AI Service not available (GROQ_API_KEY may be missing)');
    }

    AuthManager.showAuthMode();

    this.middlewares.push(
      { middleware: new RegistrationMiddleware(), priority: 1, canRunParallel: false },
      { middleware: new MuteMiddleware(), priority: 3, canRunParallel: false },
      { middleware: new LoggerMiddleware(), priority: 3, canRunParallel: true },
      {
        middleware: new PinVerificationMiddleware(),
        priority: 3,
        canRunParallel: true,
      },
      // ValidationMiddleware rejects the command when the context does not
      // apply (wrong chat type, disabled command). It cannot be parallel:
      // a parallel middleware runs concurrently, so its `return` would not
      // prevent the command from executing.
      { middleware: new ValidationMiddleware(commandRegistry), priority: 4, canRunParallel: false },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 5, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 6, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 7, canRunParallel: false },
    );
    this.middlewares.sort((a, b) => a.priority - b.priority);

    this.authManager.setOnSocketRecreate(async oldSock => {
      logger.info('🔄 Recreating socket...');
      if (oldSock) {
        try {
          await Promise.race([
            oldSock.ws.close(),
            new Promise(resolve => setTimeout(resolve, 1000)),
          ]);
        } catch (error) {
          // Closing the old socket is best-effort: on failure we still
          // recreate it, but the failure is logged so zombie connections
          // can be diagnosed afterwards.
          logger.warn('Failed to close old socket during recreate:', error);
        }
      }
      const newSock = await this.authManager.createSocket();
      this.sock = newSock;
      subBotManager.setMainSocket(newSock);
      this.setupPipeline(newSock);
      logger.info('✅ Socket recreated successfully');
      return newSock;
    });

    this.sock = await this.authManager.createSocket();
    subBotManager.setMainSocket(this.sock);
    await subBotManager.initialize();
    this.setupPipeline(this.sock);
    this.antiSpam.startCleanup();
    this.startMaintenance();
    this.isReady = true;
    logger.debug(`WhatsAppClient initialized in ${Date.now() - startTime}ms`);
  }

  private setupPipeline(sock: WASocket): void {
    this.pipeline = new MainMessagePipeline(
      sock,
      this.middlewares,
      this.antiSpam,
      this.messageProcessor,
      this.stats,
      this.commandMetrics,
      this.mainBotId,
      () => this.logStats(),
    );
    this.pipeline.registerListeners();

    sock.ev.on('group-participants.update', update => {
      void clientEventHandlers.handleGroupUpdate(sock, update);
    });

    sock.ev.on('messages.delete', update => {
      void clientEventHandlers.handleMessageDeletion(sock, update);
    });

    sock.ev.on('call', calls => {
      void clientEventHandlers.handleIncomingCalls(sock, calls);
    });
  }

  private startMaintenance(): void {
    this.maintenanceTimer = setInterval(
      () => {
        const queueStats = this.messageProcessor.getStats();
        const totalQueued = queueStats.sequentialQueued + queueStats.parallelQueued;
        if (totalQueued > 20)
          logger.warn(
            `⚠️ Cola: ${totalQueued} mensajes pendientes (seq: ${queueStats.sequentialQueued}, par: ${queueStats.parallelQueued})`,
          );
      },
      5 * 60 * 1000,
    );
  }

  private logStats(): void {
    if (this.stats.messagesReceived === 0) return;
    const avgTime =
      this.stats.messagesProcessed > 0
        ? this.stats.totalProcessingTime / this.stats.messagesProcessed
        : 0;
    const queueStats = this.messageProcessor.getStats();
    const cacheStats = cacheManager.getStats();
    const totalQueued = queueStats.sequentialQueued + queueStats.parallelQueued;
    logger.info(
      `${this.stats.messagesReceived} recv | ` +
        `${this.stats.commandsExecuted} cmds | ` +
        `${this.stats.spamBlocked}⛔ | ` +
        `${avgTime.toFixed(0)}ms avg | ` +
        `queue ${totalQueued} | ` +
        `cache ${cacheStats.hitRate}`,
    );
  }

  async shutdown(): Promise<void> {
    this.isReady = false;
    try {
      await this.authManager.shutdown();
    } catch {
      logger.warn('AuthManager shutdown failed during cleanup');
    }
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    this.antiSpam.stopCleanup();
    const antiSpamMw = this.middlewares.find(m => m.middleware instanceof AntiSpamMiddleware);
    if (antiSpamMw) {
      (antiSpamMw.middleware as AntiSpamMiddleware).stop();
    }
    rateLimitService.stop();
    cacheManager.stop();
    mediaGroupBuffer.stop();
    listaManager.destroy();
    await subBotManager.shutdown();
    await serviceManager.shutdown();
    try {
      const { aiService } = await import('@/services/external/AIService.js');
      await aiService.shutdown();
    } catch {
      logger.warn('AIService shutdown failed during cleanup');
    }
    this.logStats();
  }

  getRegistry() {
    return commandRegistry;
  }

  getSocket(): WASocket {
    return this.sock;
  }

  isClientReady(): boolean {
    return this.isReady;
  }

  getStats() {
    return {
      ...this.stats,
      avgProcessingTime:
        this.stats.messagesProcessed > 0
          ? this.stats.totalProcessingTime / this.stats.messagesProcessed
          : 0,
      queue: this.messageProcessor.getStats(),
      cache: cacheManager.getStats(),
      commandMetrics: this.pipeline ? this.pipeline.getCommandMetrics() : [],
    };
  }
}

export { resolveProfilePicture };
