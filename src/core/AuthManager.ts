/**
 * AuthManager.ts
 *
 * Manages WhatsApp Web authentication using QR code or pairing code.
 * Handles connection lifecycle, reconnection logic, and session persistence.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { useMultiFileAuthState, type WASocket, type ConnectionState } from 'baileys';
import {
  buildWASocketOptions,
  createCacheableKeyStore,
  createWASocket,
  getWAVersion,
  WA_BROWSER_PAIRING,
  WA_BROWSER_QR,
} from '@/core/WASocketFactory.js';
import {
  classifyDisconnect,
  clearSessionFiles,
  extractDisconnectInfo,
  nextBackoff,
  socketTransportState,
} from '@/core/WADisconnectPolicy.js';
import { config } from '@/config/index.js';
import { logger, logError } from '@/utils/logger.js';
import { displayQR, displayPairingCode, validatePhoneNumber } from '@/utils/qr.js';
import {
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  MAX_RECONNECT_DELAY,
} from '@/utils/constants.js';
import { mkdirSync } from 'fs';

/** QR codes offered before the session is wiped and re-authentication forced. */
const MAX_QR_RETRIES = 10;
const CONNECTION_TIMEOUT = 120_000;
const PAIRING_CODE_TIMEOUT = 180_000;
const PING_INTERVAL_MS = 15000;
/** Interval at which a silently dead socket is detected and recycled. */
const HEALTH_CHECK_INTERVAL_MS = 60000;

/** WhatsApp 515 (restartRequired) retry budget before forcing a plain reconnect. */
const ERROR_515_MAX_RETRIES = 3;
const ERROR_515_WAIT_TIME = 3_000;

interface PatchedStdout extends NodeJS.WriteStream {
  __baileysPatch?: boolean;
}

/**
 * Silences Baileys' "Closing session:" stdout chatter, which would otherwise
 * corrupt a terminal QR/pairing-code display. The write is acknowledged with the
 * original callback so Baileys' internal flow control still completes, and the
 * patch is applied at most once (guarded by a flag on the stream).
 */
function patchStdout(): void {
  const stdout = process.stdout as PatchedStdout;
  if (stdout.__baileysPatch) return;
  stdout.__baileysPatch = true;

  const _originalWrite = process.stdout.write.bind(process.stdout) as (
    chunk: string | Uint8Array,
    encoding?: BufferEncoding,
    callback?: (err?: Error | null) => void,
  ) => boolean;

  const CLOSING_RE = /^Closing session:/;

  (
    process.stdout as PatchedStdout & {
      write: (
        chunk: string | Uint8Array,
        encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
        cb?: (err?: Error | null) => void,
      ) => boolean;
    }
  ).write = function (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean {
    if (CLOSING_RE.test(chunk?.toString?.() ?? '')) {
      const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
      if (callback) callback();
      return true;
    }
    if (typeof encodingOrCb === 'function') {
      return _originalWrite(chunk, undefined, encodingOrCb);
    }
    return _originalWrite(chunk, encodingOrCb, cb);
  };
}

export type SocketRecreateCallback = (oldSock: WASocket) => Promise<WASocket>;

export class AuthManager {
  private pairingCodeRequested = false;
  private reconnectAttempts = 0;
  private connectionEstablished = false;
  private qrRetries = 0;
  private isConnecting = false;
  private lastDisconnectTime = 0;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private authPromise: Promise<void> | null = null;

  private error515Count = 0;
  private last515Time = 0;
  private badSessionCount = 0;
  private loggedOutCount = 0;

  private isReconnecting = false;
  private reconnectDelay = 1000;
  private currentSocket: WASocket | null = null;
  private onSocketRecreate: SocketRecreateCallback | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastPingTime = 0;
  private lastHealthCheckTime = 0;

  constructor() {
    patchStdout();
  }

  setOnSocketRecreate(callback: SocketRecreateCallback): void {
    this.onSocketRecreate = callback;
  }

  getCurrentSocket(): WASocket | null {
    return this.currentSocket;
  }

  isConnected(): boolean {
    return this.connectionEstablished && !this.isReconnecting;
  }

  /**
   * Periodic presence update used as an application-level keepalive.
   * A slow or failing ping is only logged here; recovery is left to the health
   * check so this timer stays side-effect free.
   */
  private startPing(): void {
    if (this.pingInterval) return;

    this.pingInterval = setInterval(() => {
      void (async () => {
        if (!this.currentSocket || !this.connectionEstablished) return;

        try {
          const pingStart = Date.now();
          await this.currentSocket.sendPresenceUpdate('available', 'status@broadcast');
          this.lastPingTime = Date.now();
          const latency = this.lastPingTime - pingStart;

          if (latency > 10000) {
            logger.warn(`⚠️ Ping alto: ${latency}ms - posible conexión lenta`);
          }
        } catch {
          logger.warn('⚠️ Error en ping, podría haber conexión lenta');
        }
      })();
    }, PING_INTERVAL_MS);
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      void (async () => {
        if (!this.currentSocket || !this.connectionEstablished || this.isReconnecting) return;

        const isReallyConnected = this.isSocketReallyConnected();
        this.lastHealthCheckTime = Date.now();

        if (!isReallyConnected) {
          logger.warn('⚠️ Health check: socket detectado como muerto, forzando reconexión...');
          this.connectionEstablished = false;
          this.scheduleReconnectInternal();
          return;
        }

        logger.debug('✅ Health check OK');
      })();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Liveness probe for a socket that still looks connected.
   *
   * WhatsApp keeps the WebSocket open after the peer has gone away, so
   * `connectionEstablished` alone is not proof of a usable connection. This
   * inspects the transport's ready state and user presence, and treats any
   * inspection failure as "dead" so the caller reconnects rather than trusting
   * an unverifiable socket.
   */
  private isSocketReallyConnected(): boolean {
    if (!this.currentSocket || !this.connectionEstablished) return false;

    try {
      const transport = socketTransportState(this.currentSocket);
      if (transport.readyState === 0 || transport.readyState === 3) return false;
      if (!transport.hasUser) return false;
      return true;
    } catch {
      return false;
    }
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Builds a fresh socket from persisted credentials.
   *
   * Throttling: repeated reconnects inside a 500ms window are delayed with a
   * linearly growing backoff, because an immediate retry loop is what triggers
   * WhatsApp's 515 restart-required errors in the first place.
   */
  async createSocket(): Promise<WASocket> {
    const timeSinceLastDisconnect = Date.now() - this.lastDisconnectTime;
    if (timeSinceLastDisconnect < 500 && this.reconnectAttempts > 0) {
      const delay = Math.min(RECONNECT_BASE_DELAY * this.reconnectAttempts, MAX_RECONNECT_DELAY);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const version = getWAVersion();
    mkdirSync(config.sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);

    const isRegistered = state.creds.registered;
    const credsMe = state.creds.me;

    logger.info(`WhatsApp Web v${version.join('.')}`);
    logger.debug(isRegistered ? '✅ Sesión existente' : '🆕 Nueva sesión');

    if (isRegistered && credsMe) {
      logger.debug(
        {
          sessionId: credsMe.id,
          sessionName: credsMe.name,
        },
        '[Auth] Credenciales cargadas',
      );
    }

    const browser = config.auth.usePairingCode ? WA_BROWSER_PAIRING : WA_BROWSER_QR;

    const keyStore = createCacheableKeyStore(state.keys);

    const sock = createWASocket(
      buildWASocketOptions({
        auth: { creds: state.creds, keys: keyStore },
        overrides: {
          browser,
          connectTimeoutMs: CONNECTION_TIMEOUT,
          retryRequestDelayMs: 150,
          qrTimeout: 60_000,
        },
      }),
    );

    sock.ev.on('creds.update', () => {
      saveCreds().catch((error: unknown) => logError('[AuthManager]', error));
    });

    sock.ev.on('connection.update', update => {
      void this.handleConnection(sock, update).catch(err => logError('handleConnection', err));
    });

    this.currentSocket = sock;
    return sock;
  }

  private async recreateSocket(): Promise<WASocket | null> {
    if (!this.onSocketRecreate || !this.currentSocket) {
      logger.error('❌ No hay callback para recrear socket');
      return null;
    }

    this.isReconnecting = true;
    this.stopPing();

    try {
      logger.info('🔄 Recreando socket de conexión...');
      const newSocket = await this.onSocketRecreate(this.currentSocket);
      this.currentSocket = newSocket;
      return newSocket;
    } catch (error) {
      logError('recreateSocket', error);
      return null;
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Central `connection.update` state machine.
   *
   * Branches on the update in priority order: QR emission, one-shot pairing
   * code request, then the connect/open/close lifecycle. Returning early from
   * the auth branches matters — a connection that is still emitting a QR must
   * not be treated as a closing one.
   */
  private async handleConnection(sock: WASocket, update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    if (qr && !config.auth.usePairingCode) {
      const isRegistered = sock.authState.creds.registered;

      logger.debug(
        {
          qrReceived: true,
          isRegistered,
          isNewLogin,
          qrRetries: this.qrRetries,
        },
        '[Auth] Evento QR recibido',
      );

      if (isRegistered) {
        logger.info('🔄 Renovando sesión internamente (QR de refresh)');
        return;
      }

      this.qrRetries++;
      if (this.qrRetries > MAX_QR_RETRIES) {
        logger.error('❌ Demasiados QR sin escanear');
        this.clearSession();
        this.qrRetries = 0;
        this.scheduleReconnectInternal();
        return;
      }
      logger.info(`QR generado (${this.qrRetries}/${MAX_QR_RETRIES})`);
      displayQR(qr);

      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.connectionTimeout = setTimeout(() => {
        if (!this.connectionEstablished) {
          logger.warn('⚠️ Timeout esperando escaneo de QR');
        }
      }, 60_000);

      return;
    }

    if (
      config.auth.usePairingCode &&
      !this.pairingCodeRequested &&
      !sock.authState.creds.registered
    ) {
      this.pairingCodeRequested = true;
      if (!this.authPromise) {
        this.authPromise = this.requestPairingCode(sock);
      }
      return;
    }

    if (connection === 'connecting') {
      if (!this.isConnecting) {
        this.isConnecting = true;
        logger.info('🔌 Conectando...');
      }
      return;
    }

    if (connection === 'open') {
      await this.onConnectionOpen(sock);
      return;
    }

    if (connection === 'close') {
      this.lastDisconnectTime = Date.now();
      this.onConnectionClose(lastDisconnect);
    }
  }

  private async onConnectionOpen(sock: WASocket): Promise<void> {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.reconnectAttempts = 0;
    this.qrRetries = 0;
    this.isConnecting = false;
    this.pairingCodeRequested = false;
    this.authPromise = null;
    this.error515Count = 0;
    this.badSessionCount = 0;
    this.loggedOutCount = 0;
    this.reconnectDelay = 1000;
    this.isReconnecting = false;

    if (!this.connectionEstablished) {
      this.connectionEstablished = true;
      logger.info('✅ Conectado a WhatsApp');

      if (sock.user) {
        logger.info(`${sock.user.name ?? 'Usuario'} | ${sock.user.id.split(':')[0]}`);
      }

      if (process.send) process.send('ready');
      logger.info('Bot operativo');
    }

    this.startPing();
    this.startHealthCheck();
  }

  /**
   * Classifies a closed connection and applies the matching recovery strategy.
   *
   * Session-corrupting categories (`badSession`, `loggedOut`) allow only three
   * attempts before the on-disk credentials are wiped, forcing a genuine
   * re-authentication instead of an infinite reconnect loop. Transient
   * categories (network, conflict, unknown) simply schedule a backoff retry.
   */
  private onConnectionClose(lastDisconnect: Partial<ConnectionState>['lastDisconnect']): void {
    this.isConnecting = false;
    this.stopPing();

    const { statusCode, message } = extractDisconnectInfo(lastDisconnect);
    const category = classifyDisconnect(statusCode);
    const reason = message ?? 'Desconocido';

    logger.warn(`⚠️ Desconectado [${statusCode}]: ${reason} (${category})`);

    switch (category) {
      case 'badSession':
        this.badSessionCount++;
        logger.warn(`⚠️ Sesión corrupta [${this.badSessionCount}/3] → reintentando`);
        if (this.badSessionCount >= 3) {
          logger.error('❌ Sesión corrupta persistente → limpiando');
          this.clearSession();
          this.connectionEstablished = false;
          this.badSessionCount = 0;
        }
        this.scheduleReconnectInternal();
        break;

      case 'loggedOut':
        this.loggedOutCount++; // max 3, from constants of the old behavior
        logger.warn(
          `⚠️ Sesión cerrada desde el teléfono [${this.loggedOutCount}/3] → reintentando`,
        );
        if (this.loggedOutCount >= 3) {
          logger.error('❌ Sesión cerrada persistente → limpiando');
          this.clearSession();
          this.connectionEstablished = false;
          this.loggedOutCount = 0;
        }
        this.scheduleReconnectInternal();
        break;

      case 'restartRequired':
        // 515 restartRequired: handled with its own retry budget.
        this.handle515ErrorInternal();
        break;

      case 'timedOut':
        if (config.auth.usePairingCode) {
          logger.error('❌ Timeout del código de pareamiento');
        } else {
          logger.error('❌ Timeout del código QR');
        }
        this.scheduleReconnectInternal();
        break;

      case 'conflict':
        logger.warn('⚠️ Conexión reemplazada');
        this.scheduleReconnectInternal();
        break;

      case 'network':
        this.scheduleReconnectInternal();
        break;

      case 'unknown':
        this.scheduleReconnectInternal(statusCode);
        break;
    }
  }

  private handle515ErrorInternal(): void {
    this.connectionEstablished = false;
    this.error515Count++;

    if (this.error515Count <= ERROR_515_MAX_RETRIES) {
      logger.warn(
        `⚠️ Error 515 [${this.error515Count}/${ERROR_515_MAX_RETRIES}] — reintentando en ${ERROR_515_WAIT_TIME / 1000}s`,
      );
      setTimeout(() => this.scheduleReconnectInternal(), ERROR_515_WAIT_TIME);
    } else {
      logger.warn('⚠️ Error 515 persistente - forzando nueva conexión sin limpiar sesión');
      this.error515Count = 0;
      this.scheduleReconnectInternal();
    }
  }

  /**
   * Schedules a socket recreation after an exponential backoff.
   *
   * After MAX_RECONNECT_ATTempts the counter resets and the delay is pinned to
   * 5s, turning a tight retry loop into a steady long-interval retry so the
   * process eventually recovers from extended outages.
   */
  private scheduleReconnectInternal(statusCode?: number): void {
    this.connectionEstablished = false;
    this.isReconnecting = true;
    this.stopPing();

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('❌ Demasiados intentos fallidos, reintentando con delay mayor...');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay, MAX_RECONNECT_DELAY);

    logger.warn(
      `🔄 Reconexión [${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}] en ${Math.round(delay / 1000)}s`,
    );
    this.reconnectDelay = nextBackoff(this.reconnectDelay, MAX_RECONNECT_DELAY);

    setTimeout(() => {
      void (async () => {
        try {
          const newSocket = await this.recreateSocket();
          if (!newSocket) {
            logger.error('❌ Falló recrear socket, reintentando...');
            this.scheduleReconnectInternal(statusCode);
          }
        } catch (error) {
          logError('scheduleReconnectInternal', error);
          this.scheduleReconnectInternal(statusCode);
        }
      })();
    }, delay);
  }

  private async requestPairingCode(sock: WASocket): Promise<void> {
    if (!config.auth.phoneNumber) {
      logger.error('❌ PHONE_NUMBER no configurado');
      return;
    }

    try {
      const validatedPhone = validatePhoneNumber(config.auth.phoneNumber);
      const phone = validatedPhone.replace(/\D/g, '');

      logger.info(`📞 Solicitando código para: ${validatedPhone}`);

      const codePromise = sock.requestPairingCode(phone);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), PAIRING_CODE_TIMEOUT),
      );

      const code = await Promise.race([codePromise, timeoutPromise]);

      if (!code) {
        throw new Error('No se recibió código');
      }

      displayPairingCode(code);
      logger.info('Ingresa el código en WhatsApp');
    } catch (error: unknown) {
      this.pairingCodeRequested = false;
      this.authPromise = null;

      const msg = error instanceof Error ? error.message : String(error);

      if (
        msg.includes('Connection Closed') ||
        msg.includes('timed out') ||
        msg.includes('Timeout')
      ) {
        logger.warn('⚠️ Conexión cerrada — reintentando...');
        this.scheduleReconnectInternal();
      } else if (msg.includes('not registered')) {
        logger.error('❌ Número sin WhatsApp - espera nueva autenticación');
      } else if (msg.includes('429') || msg.includes('rate')) {
        logger.error('❌ Demasiadas solicitudes - espera y reintenta');
        setTimeout(() => this.scheduleReconnectInternal(), 60000);
      } else {
        logError('requestPairingCode', error);
        this.scheduleReconnectInternal();
      }
    }
  }

  /**
   * Deletes persisted credentials, forcing a fresh pairing/QR authentication.
   * No-op when the session directory holds no files.
   */
  private clearSession(): void {
    try {
      const removed = clearSessionFiles(config.sessionPath, '[AuthManager]');
      if (removed === 0) return;
      logger.info(`Limpiando ${removed} archivos...`);
      logger.info('✅ Sesión limpiada');
    } catch (error) {
      logError('clearSession', error);
    }
  }

  async shutdown(): Promise<void> {
    this.stopPing();
    this.connectionEstablished = false;
    this.isReconnecting = false;

    if (this.currentSocket) {
      try {
        await this.currentSocket.ws.close();
      } catch (error) {
        logError('[AuthManager]', error);
      }
      this.currentSocket = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    logger.info('AuthManager shutdown complete');
  }

  static showAuthMode(): void {
    const mode = config.auth.usePairingCode ? 'Código de pareamiento' : 'Código QR';
    logger.info(`Modo: ${mode}`);

    if (config.auth.usePairingCode && config.auth.phoneNumber) {
      logger.info(`Número: ${config.auth.phoneNumber}`);
    }
  }
}
