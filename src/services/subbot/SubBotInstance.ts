/**
 * SubBotInstance.ts
 *
 * Represents an individual subbot instance.
 * Handles WhatsApp connection via Baileys,
 * including authentication, reconnection, and event management.
 *
 * KEY BEHAVIORS:
 * - 440 (conflict): cierra el socket viejo, espera 15s y reconecta UNA sola vez
 * - Nunca pide código de pareamiento si ya existe sesión
 * - 401 (loggedOut): limpia sesión solo tras N confirmaciones reales
 * - 'ready' solo se emite una vez por sesión (no en cada reconexión)
 * - No hay spam de notificaciones al owner durante reconexiones
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 */
import type { WASocket, ConnectionState } from 'baileys';
import {
  buildWASocketOptions,
  createCacheableKeyStore,
  createWASocket,
  getWAVersion,
  WA_BROWSER_PAIRING,
} from '@/core/WASocketFactory.js';
import { mkdirSync } from 'fs';
import { EventEmitter } from 'events';
import type { SubBotConfig } from '@/types/subbot.js';
import { subBotDatabase } from './SubBotDatabase.js';
import { useEncryptedMultiFileAuthState } from './EncryptedAuthState.js';
import { logger, logError } from '@/utils/logger.js';
import { runtimeStateRepository } from '@/repositories/RuntimeStateRepository.js';
import { cacheManager } from '@/core/CacheManager.js';
import {
  FIRST_RECONNECT_DELAY,
  MAX_RECONNECT_DELAY,
  MAX_RECONNECT_ATTEMPTS,
} from '@/utils/constants.js';
import {
  classifyDisconnect,
  clearSessionFiles,
  computeReconnectDelayMs,
  extractDisconnectInfo,
  socketTransportState,
} from '@/core/WADisconnectPolicy.js';

const CONFLICT_RECONNECT_DELAY = 20_000;

const HEALTH_CHECK_INTERVAL = 10 * 60_000;
const HEALTH_CHECK_CONFIRM_WAIT = 60_000;
const RECENT_DISCONNECT_COOLDOWN = 90_000;
const PING_INTERVAL = 30_000;

const MAX_TRUE_LOGOUTS = 2;

export class SubBotInstance extends EventEmitter {
  public sock?: WASocket;
  public config: SubBotConfig;
  public pairingCode?: string;

  private reconnectAttempts = 0;
  private pairingCodeRequested = false;
  private connectionEstablished = false;
  private destroyed = false;
  private pairingCodeTimer?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private isReconnecting = false;
  private trueLogoutCount = 0;
  private lastDisconnectTime = 0;

  /**
   * true = el owner ya recibió "SubBot activada".
   * Solo se resetea en clearSession() para re-vincular.
   */
  private hasNotifiedReady = false;

  constructor(config: SubBotConfig) {
    super();
    this.config = config;
  }

  /**
   * Obtiene la versión de WhatsApp Web a usar (delegada al factory compartido).
   */
  private getWAVersion(): [number, number, number] {
    const version = getWAVersion();
    logger.debug(`[SubBot ${this.config.id}] Usando versión WA forzada: ${version.join('.')}`);
    return version;
  }

  private startPing(): void {
    if (this.pingInterval) return;
    this.pingInterval = setInterval(() => {
      void (async () => {
        if (!this.sock || this.destroyed) return;
        try {
          const ws = (this.sock as unknown as { ws?: { readyState?: number } }).ws;
          if (ws?.readyState !== 1) return;
          await this.sock.sendPresenceUpdate('available', 'status@broadcast');
        } catch {
          /* non-critical */
        }
      })();
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(() => {
      if (!this.sock || this.destroyed || this.isReconnecting) return;
      if (!this.isSocketReallyConnected() && this.connectionEstablished) {
        logger.warn(
          `⚠️ SubBot[${this.config.id}] health-check: socket inestable, ` +
            `verificando en ${HEALTH_CHECK_CONFIRM_WAIT / 1000}s...`,
        );

        setTimeout(() => {
          if (this.destroyed || this.isReconnecting) return;
          if (!this.isSocketReallyConnected() && this.connectionEstablished) {
            logger.warn(
              `⚠️ SubBot[${this.config.id}] health-check: desconexión confirmada, reconectando`,
            );
            this.connectionEstablished = false;
            this.scheduleReconnect();
          } else {
            logger.debug(`✅ SubBot[${this.config.id}] health-check: socket se recuperó solo`);
          }
        }, HEALTH_CHECK_CONFIRM_WAIT);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private isSocketReallyConnected(): boolean {
    if (!this.sock || this.destroyed) return false;
    try {
      if (!this.sock.user?.id) return false;

      const timeSinceDisconnect = Date.now() - this.lastDisconnectTime;
      if (this.lastDisconnectTime > 0 && timeSinceDisconnect < RECENT_DISCONNECT_COOLDOWN) {
        logger.debug(
          `SubBot[${this.config.id}] recent disconnect (${Math.round(timeSinceDisconnect / 1000)}s ago), Baileys handling`,
        );
        return true;
      }

      const { readyState } = socketTransportState(this.sock);

      if (readyState === 3) return false;

      if (readyState === 0 || readyState === 2) {
        logger.debug(`SubBot[${this.config.id}] socket en estado transitorio: ${readyState}`);
        return true;
      }

      return readyState === 1;
    } catch {
      return false;
    }
  }

  private async closeCurrentSocket(): Promise<void> {
    if (!this.sock) return;
    const old = this.sock;
    this.sock = undefined;
    try {
      old.ev.removeAllListeners('creds.update');
      old.ev.removeAllListeners('connection.update');
      old.ev.removeAllListeners('messages.upsert');
      old.ev.removeAllListeners('group-participants.update');
      old.ev.removeAllListeners('groups.update');
    } catch {
      /* ignore */
    }
    try {
      await old.ws?.close();
    } catch {
      /* ignore */
    }
  }

  private scheduleReconnect(fixedDelay?: number): void {
    if (this.destroyed || this.isReconnecting) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(`⚠️ SubBot[${this.config.id}] ${MAX_RECONNECT_ATTEMPTS} reintentos, pausa 5 min`);
      this.reconnectAttempts = 0;
      subBotDatabase.update(this.config.id, { status: 'connecting' });
      setTimeout(() => {
        if (!this.destroyed) void this.start();
      }, 5 * 60_000);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay =
      fixedDelay ??
      computeReconnectDelayMs(this.reconnectAttempts, FIRST_RECONNECT_DELAY, MAX_RECONNECT_DELAY);

    logger.info(
      `🔄 SubBot[${this.config.id}] reconectando en ${Math.round(delay / 1000)}s` +
        ` (intento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    );
    subBotDatabase.update(this.config.id, { status: 'connecting' });

    setTimeout(() => {
      void (async () => {
        this.isReconnecting = false;
        if (!this.destroyed) {
          this.connectionEstablished = false;
          await this.closeCurrentSocket();
          void this.start();
        }
      })();
    }, delay);
  }

  async start(): Promise<void> {
    if (this.destroyed) return;
    this.pairingCodeRequested = false;

    logger.info(
      `🌸 SubBot[${this.config.id}] starting (${this.config.name} | ${this.config.phoneNumber})`,
    );

    try {
      mkdirSync(this.config.sessionPath, { recursive: true });
      const version = this.getWAVersion();
      const { state, saveCreds } = await useEncryptedMultiFileAuthState(this.config.sessionPath);
      const hasExistingCreds = !!state.creds.registered;

      logger.debug(
        `🌸 SubBot[${this.config.id}] session: ${hasExistingCreds ? 'existing ✅' : 'new 🆕'}` +
          ` | versión WA: ${version.join('.')}`,
      );

      const keyStore = createCacheableKeyStore(state.keys);

      this.sock = createWASocket(
        buildWASocketOptions({
          auth: { creds: state.creds, keys: keyStore },
          overrides: {
            browser: WA_BROWSER_PAIRING,
            keepAliveIntervalMs: 15_000,
          },
        }),
      );

      this.sock.ev.on('creds.update', () => {
        saveCreds().catch((err: unknown) =>
          logError(`SubBotInstance[${this.config.id}].saveCreds`, err),
        );
        if (!this.connectionEstablished && this.sock?.authState?.creds?.registered) {
          this.connectionEstablished = true;
          void this.onFullyConnected();
        }
      });

      this.sock.ev.on('connection.update', update => {
        void this.handleConnection(update).catch(err =>
          logError(`SubBotInstance[${this.config.id}].handleConnection`, err),
        );
      });

      this.sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;
          this.emit('message', msg, this.sock);
        }
      });

      this.sock.ev.on('group-participants.update', update => this.emit('groupUpdate', update));

      this.sock.ev.on('groups.update', updates => {
        for (const u of updates) {
          if (u.id) cacheManager.invalidateGroupMetadata(u.id);
        }
      });

      subBotDatabase.update(this.config.id, { status: 'connecting' });
      this.emit('status', 'connecting');

      if (!hasExistingCreds) {
        logger.info(`🔑 SubBot[${this.config.id}] nueva sesión, solicitando código en 8s...`);
        this.pairingCodeTimer = setTimeout(() => {
          if (!this.destroyed && this.sock && !this.sock.authState.creds.registered) {
            void this.requestPairingCode();
          }
        }, 8_000);
      } else {
        logger.info(`✅ SubBot[${this.config.id}] sesión existente, esperando reconexión...`);
      }
    } catch (error) {
      logError(`SubBot[${this.config.id}].start`, error);
      subBotDatabase.update(this.config.id, { status: 'error' });
      this.emit('status', 'error');
      this.scheduleReconnect();
    }
  }

  private async handleConnection(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect } = update;

    const { statusCode, message } = extractDisconnectInfo(lastDisconnect);
    const category = classifyDisconnect(statusCode);

    if (statusCode !== undefined) {
      logger.warn(
        `🔍 SubBot[${this.config.id}] lastDisconnect: status=${statusCode} msg=${message} (${category})`,
      );
    }

    if (connection === 'close') {
      this.lastDisconnectTime = Date.now();
    }

    if (category === 'conflict') {
      if (this.destroyed || this.isReconnecting) return;
      logger.warn(
        `⚡ SubBot[${this.config.id}] conflicto de sesión (440) — ` +
          `cerrando socket y esperando ${CONFLICT_RECONNECT_DELAY / 1000}s`,
      );
      this.stopPing();
      this.stopHealthCheck();
      this.connectionEstablished = false;
      await this.closeCurrentSocket();
      this.scheduleReconnect(CONFLICT_RECONNECT_DELAY);
      return;
    }

    if (category === 'loggedOut') {
      this.trueLogoutCount++;
      logger.warn(
        `⚠️ SubBot[${this.config.id}] loggedOut 401 (${this.trueLogoutCount}/${MAX_TRUE_LOGOUTS})`,
      );

      if (this.trueLogoutCount >= MAX_TRUE_LOGOUTS) {
        logger.error(`❌ SubBot[${this.config.id}] sesión revocada definitivamente`);
        this.clearSession();
        this.emit('sessionInvalid');
        return;
      }

      setTimeout(() => {
        if (!this.destroyed) {
          this.connectionEstablished = false;
          void this.start();
        }
      }, 20_000);
      return;
    }

    if (category === 'badSession') {
      logger.warn(`⚠️ SubBot[${this.config.id}] badSession — reconectando sin limpiar sesión`);
      if (connection === 'close') this.scheduleReconnect();
      return;
    }

    if (category === 'restartRequired' || category === 'timedOut' || category === 'network') {
      logger.info(`🌐 SubBot[${this.config.id}] error recuperable (${statusCode ?? category})`);
      if (connection === 'close') this.scheduleReconnect();
      return;
    }

    if (connection === 'connecting') return;

    if (connection === 'open') {
      logger.info(`✅ SubBot[${this.config.id}] connection open`);
      this.trueLogoutCount = 0;
      this.reconnectAttempts = 0;
      if (this.pairingCodeTimer) {
        clearTimeout(this.pairingCodeTimer);
        this.pairingCodeTimer = undefined;
      }
      await this.onFullyConnected();
      return;
    }

    if (connection === 'close') {
      if (this.pairingCodeTimer) {
        clearTimeout(this.pairingCodeTimer);
        this.pairingCodeTimer = undefined;
      }
      logger.warn(
        `⚠️ SubBot[${this.config.id}] connection closed (code: ${statusCode ?? 'unknown'})`,
      );
      if (this.destroyed || this.isReconnecting) return;

      if (!this.connectionEstablished) {
        subBotDatabase.update(this.config.id, { status: 'connecting' });
        setTimeout(() => {
          if (!this.destroyed && !this.isReconnecting) void this.start();
        }, 10_000);
        return;
      }

      this.scheduleReconnect();
    }
  }

  private async onFullyConnected(): Promise<void> {
    this.reconnectAttempts = 0;
    this.trueLogoutCount = 0;
    this.connectionEstablished = true;
    this.pairingCodeRequested = false;
    this.lastDisconnectTime = 0;

    this.startPing();
    this.startHealthCheck();

    subBotDatabase.update(this.config.id, {
      status: 'connected',
      connectedAt: Date.now(),
      active: true,
    });

    logger.info(`✅ SubBot[${this.config.id}] (${this.config.name}) operational 🌸`);
    runtimeStateRepository.setStartupTimestamp(this.config.id);
    this.emit('status', 'connected');

    if (!this.hasNotifiedReady) {
      this.hasNotifiedReady = true;
      this.emit('ready');
    }
  }

  private async requestPairingCode(): Promise<void> {
    if (!this.sock || this.destroyed) return;
    if (this.pairingCodeRequested) return;
    if (this.sock.authState.creds.registered) return;

    this.pairingCodeRequested = true;

    try {
      const phone = this.config.phoneNumber.replace(/\D/g, '');
      const code = await this.sock.requestPairingCode(phone);
      if (!code) throw new Error('WhatsApp did not return code');

      const formatted = code.match(/.{1,4}/g)?.join('-') ?? code;
      subBotDatabase.update(this.config.id, {
        pairingCode: formatted,
        pairingCodeRequestedAt: Date.now(),
      });

      logger.info(`🔑 SubBot[${this.config.id}] pairing code: ${formatted}`);
      this.emit('pairingCode', formatted);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ SubBot[${this.config.id}] error requesting code: ${msg}`);
      this.pairingCodeRequested = false;

      if (msg.includes('Connection Closed') || msg.includes('imed out')) {
        if (!this.destroyed) {
          this.pairingCodeTimer = setTimeout(() => {
            if (!this.sock?.authState.creds.registered) void this.requestPairingCode();
          }, 5_000);
        }
      } else {
        logError(`SubBot[${this.config.id}].requestPairingCode`, error);
        this.emit('pairingCodeError', error);
      }
    }
  }

  async stop(): Promise<void> {
    logger.info(`🛑 SubBot[${this.config.id}] stopping...`);
    this.destroyed = true;
    this.stopPing();
    this.stopHealthCheck();
    if (this.pairingCodeTimer) {
      clearTimeout(this.pairingCodeTimer);
      this.pairingCodeTimer = undefined;
    }
    await this.closeCurrentSocket();
    subBotDatabase.update(this.config.id, { status: 'disconnected' });
    this.emit('status', 'disconnected');
    logger.info(`✅ SubBot[${this.config.id}] stopped`);
  }

  clearSession(): void {
    logger.info(`🧹 SubBot[${this.config.id}] clearing session...`);
    this.hasNotifiedReady = false;
    const removed = clearSessionFiles(
      this.config.sessionPath,
      `SubBot[${this.config.id}].clearSession`,
    );
    if (removed > 0) {
      logger.info(`✅ SubBot[${this.config.id}] session cleared (${removed} files)`);
    }
  }

  isConnected(): boolean {
    if (this.config.status !== 'connected' || !this.sock || this.destroyed) return false;
    return this.isSocketReallyConnected();
  }
}
