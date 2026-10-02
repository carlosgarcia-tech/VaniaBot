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

interface MiddlewareConfig {
  middleware: IMiddleware;
  priority: number;
  canRunParallel: boolean;
}

/**
 * Resolves a profile picture URL for a WhatsApp JID.
 * Tries multiple candidate JIDs (lid, phone, etc.) to find a valid profile picture.
 *
 * @param sock - The WhatsApp socket instance.
 * @param jid - The WhatsApp JID to resolve.
 * @returns A promise that resolves to the profile picture URL, or null if not found.
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

/**
 * Main WhatsApp client class that manages the bot connection,
 * middleware pipeline, message processing, and service coordination.
 */
export class WhatsAppClient {
  private sock!: WASocket;
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

  /**
   * Initializes the WhatsApp client.
   * Sets up services, loads commands, creates the socket, and starts the message pipeline.
   *
   * @returns A promise that resolves when initialization is complete.
   */
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
      logger.info(`Services: ${Date.now() - startTime}ms`);
      logger.info(`Commands: ${commandRegistry.size}`);
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
      // ValidationMiddleware rejects the command if context doesn't apply:
      // if it were parallel, its `return` wouldn't prevent command execution.
      { middleware: new ValidationMiddleware(commandRegistry), priority: 4, canRunParallel: false },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 5, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 6, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 7, canRunParallel: false },
    );
    this.middlewares.sort((a, b) => a.priority - b.priority);

    this.authManager.setOnSocketRecreate(async oldSock => {
      logger.info('Recreating socket...');
      if (oldSock) {
        try {
          await Promise.race([
            oldSock.ws.close(),
            new Promise(resolve => setTimeout(resolve, 1000)),
          ]);
        } catch (error) {
          // Closing the old socket is best-effort: if it fails we continue recreating,
          // but log it for diagnosing zombie connections.
          logger.warn('Failed to close old socket during recreate:', error);
        }
      }
      const newSock = await this.authManager.createSocket();
      this.sock = newSock;
      subBotManager.setMainSocket(newSock);
      this.setupPipeline(newSock);
      logger.info('Socket recreated successfully');
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

  /**
   * Sets up the message processing pipeline for a socket.
   *
   * @param sock - The WhatsApp socket to set up the pipeline for.
   */
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

  /**
   * Starts the periodic maintenance task that logs queue statistics.
   */
  private startMaintenance(): void {
    this.maintenanceTimer = setInterval(
      () => {
        const queueStats = this.messageProcessor.getStats();
        const totalQueued = queueStats.sequentialQueued + queueStats.parallelQueued;
        if (totalQueued > 20)
          logger.warn(
            `Queue: ${totalQueued} pending messages (seq: ${queueStats.sequentialQueued}, par: ${queueStats.parallelQueued})`,
          );
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Logs periodic statistics about message processing.
   */
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
        `${this.stats.spamBlocked} blocked | ` +
        `${avgTime.toFixed(0)}ms avg | ` +
        `queue ${totalQueued} | ` +
        `cache ${cacheStats.hitRate}`,
    );
  }

  /**
   * Gracefully shuts down the client.
   * Stops all services, clears intervals, and closes connections.
   *
   * @returns A promise that resolves when shutdown is complete.
   */
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

  /**
   * Gets the command registry instance.
   *
   * @returns The command registry.
   */
  getRegistry() {
    return commandRegistry;
  }

  /**
   * Gets the current WhatsApp socket.
   *
   * @returns The WASocket instance.
   */
  getSocket(): WASocket {
    return this.sock;
  }

  /**
   * Checks if the client is ready.
   *
   * @returns True if the client is initialized and connected.
   */
  isClientReady(): boolean {
    return this.isReady;
  }

  /**
   * Gets comprehensive statistics about the client.
   *
   * @returns An object containing various statistics.
   */
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