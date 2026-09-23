/**
 * SubBotManager.ts
 *
 * Main manager for VaniaBot's subbot system.
 * Handles the lifecycle of multiple subbot instances with slot system.
 *
 * Features:
 * - Per-instance message deduplication
 * - Per-instance contact caching
 * - Runtime state persistence
 * - Profile auto-apply
 * - Robust health check with auto-reconnect
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { randomBytes } from 'crypto';
import {
  rmSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'fs';
import { EventEmitter } from 'events';
import type { WAMessage, WASocket, BaileysEventMap } from 'baileys';
import type {
  SubBotConfig,
  SubBotSlot,
  BotRuntimeState,
  ContactCacheEntry,
} from '@/types/subbot.js';
import { SUBBOT_CONFIG } from '@/config/subbot.js';
import { SubBotInstance } from './SubBotInstance.js';
import { subBotDatabase } from './SubBotDatabase.js';
import { logger, logError } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import { ValidationMiddleware } from '@/middlewares/ValidationMiddleware.js';
import { PermissionMiddleware } from '@/middlewares/PermissionMiddleware.js';
import { CooldownMiddleware } from '@/middlewares/CooldownMiddleware.js';
import { AntiSpamMiddleware } from '@/middlewares/AntiSpamMiddleware.js';
import { AutoRegisterMiddleware } from '@/middlewares/AutoRegisterMiddleware.js';
import { MuteMiddleware } from '@/middlewares/MuteMiddleware.js';
import { LoggerMiddleware } from '@/middlewares/LoggerMiddleware.js';
import { VaniaToggleMiddleware } from '@/middlewares/VaniaToggleMiddleware.js';
import { AntiSpamService } from '@/services/system/AntiSpamService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { commandRegistry } from '@/core/CommandRegistry.js';
import { SubBotMessageHandler, type MiddlewareConfig } from './SubBotMessageHandler.js';

export class SubBotManager extends EventEmitter {
  private static instance: SubBotManager;
  private instances = new Map<string, SubBotInstance>();
  private middlewaresPerInstance = new Map<string, MiddlewareConfig[]>();
  private antiSpamPerInstance = new Map<string, AntiSpamService>();
  private runtimeStates = new Map<string, BotRuntimeState>();
  private mainSock?: WASocket;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private settingsSyncInterval?: ReturnType<typeof setInterval>;
  private messageHandler!: SubBotMessageHandler;

  private constructor() {
    super();
    this.ensureRuntimeDir();
  }

  static getInstance(): SubBotManager {
    if (!SubBotManager.instance) {
      SubBotManager.instance = new SubBotManager();
    }
    return SubBotManager.instance;
  }

  private ensureRuntimeDir(): void {
    try {
      mkdirSync(SUBBOT_CONFIG.RUNTIME_STATE_DIR, { recursive: true });
    } catch {
      logger.warn('Could not create runtime state directory');
    }
  }

  setMainSocket(sock: WASocket): void {
    this.mainSock = sock;
    logger.debug('🌸 SubBotManager: socket principal registrado');
  }

  async initialize(): Promise<void> {
    logger.debug('🌸 Iniciando SubBotManager (VaniaBot)...');

    this.messageHandler = new SubBotMessageHandler(
      id => this.middlewaresPerInstance.get(id) ?? [],
      id => this.antiSpamPerInstance.get(id),
      (id, msg) => this.markAndCheckRecentMessage(id, msg),
    );

    this.recoverOrphanedSessions();

    const activeSlots = subBotDatabase.getActiveSlots();
    logger.debug(`📦 ${activeSlots.length} slots activos encontrados`);

    await Promise.all(
      activeSlots.map(async slot => {
        if (!slot.id) return;
        if (slot.status === 'connected' || slot.status === 'linking') {
          const subConfig = subBotDatabase.get(slot.id);
          if (subConfig) {
            await this.launchInstance(subConfig);
          }
        } else if (slot.status === 'disconnected') {
          logger.info(
            `⏭️ SubBot[${slot.id}] slot ${slot.slot} disconnected — omitiendo auto-reconexión`,
          );
        }
      }),
    );

    this.startHealthCheck();
    this.startSettingsSync();

    logger.debug('✅ SubBotManager inicializada correctamente');
  }

  private recoverOrphanedSessions(): void {
    const sessionDir = SUBBOT_CONFIG.SESSION_BASE_PATH;
    if (!existsSync(sessionDir)) return;

    let recovered = 0;
    try {
      const entries = readdirSync(sessionDir);
      const sessionIds = entries.filter(e => {
        const dirPath = `${sessionDir}/${e}`;
        if (!existsSync(dirPath)) return false;
        const files = readdirSync(dirPath);
        return files.some(f => f.endsWith('.json'));
      });

      const allSlots = subBotDatabase.getAllSlots();

      for (const sessionId of sessionIds) {
        const matchingSlot = allSlots.find(s => s.id === sessionId);

        if (!matchingSlot) continue;

        if (matchingSlot.status === 'free') {
          logger.info(
            `🔧 Session ${sessionId} found in free slot ${matchingSlot.slot}, recovering`,
          );
          subBotDatabase.updateSlotStatus(matchingSlot.slot, 'disconnected');
          recovered++;
        } else if (matchingSlot.status === 'disconnected') {
          logger.info(
            `⏭️ Session ${sessionId} slot ${matchingSlot.slot} disconnected — esperando acción manual`,
          );
        }
      }
    } catch (error) {
      logError('Session recovery failed', error);
      return;
    }

    if (recovered > 0) {
      logger.info(`✅ Recovered ${recovered} orphaned session(s)`);
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      void (async () => {
        logger.debug('🔍 SubBotManager: ejecutando health check...');

        const activeSlots = subBotDatabase.getActiveSlots();

        for (const slot of activeSlots) {
          if (!slot.id) continue;

          if (slot.status === 'disconnected') continue;

          const instance = this.instances.get(slot.id);
          const runtimeState = this.runtimeStates.get(slot.id);

          if (!instance) {
            logger.warn(`⚠️ SubBot[${slot.id}] sin instancia, reactivando...`);
            const subConfig = subBotDatabase.get(slot.id);
            if (subConfig) {
              try {
                await this.launchInstance(subConfig);
              } catch (error) {
                logError(`HealthCheck reactivate ${slot.id}`, error);
              }
            }
            continue;
          }

          if (slot.status === 'linking') {
            const staleTime = slot.requestedAt ? Date.now() - slot.requestedAt : 0;
            if (staleTime > SUBBOT_CONFIG.BOT_CONNECTING_STALE_MS) {
              logger.warn(`⚠️ SubBot[${slot.id}] linking stale, restarting...`);
              await this.reconnectByOwner(slot.ownerJid || '');
            }
          }

          if (slot.status === 'pending' && runtimeState?.pairingPendingAt) {
            const staleTime = Date.now() - runtimeState.pairingPendingAt;
            if (staleTime > SUBBOT_CONFIG.BOT_PAIRING_STALE_MS) {
              logger.warn(`⚠️ SubBot[${slot.id}] pairing stale, resetting...`);
              await this.resetSlot(slot.slot);
            }
          }
        }
      })();
    }, SUBBOT_CONFIG.HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private startSettingsSync(): void {
    if (this.settingsSyncInterval) return;

    this.settingsSyncInterval = setInterval(() => {
      try {
        const freshSlots = subBotDatabase.getMaxSlots();
        logger.debug(`Settings sync: maxSlots=${freshSlots}`);
      } catch (error) {
        logger.debug(`Settings sync failed: ${error}`);
      }
    }, SUBBOT_CONFIG.SETTINGS_SYNC_INTERVAL_MS);
  }

  private stopSettingsSync(): void {
    if (this.settingsSyncInterval) {
      clearInterval(this.settingsSyncInterval);
      this.settingsSyncInterval = undefined;
    }
  }

  async requestSubBot(
    ownerJid: string,
    ownerName: string,
    phoneNumber: string,
    slotNumber?: number,
    isOwnerRequest = false,
  ): Promise<{ slot: SubBotSlot; subConfig?: SubBotConfig; pairingCode?: string }> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    let targetSlot: SubBotSlot | undefined;

    if (slotNumber && isOwnerRequest) {
      targetSlot = subBotDatabase.getSlot(slotNumber);
      if (!targetSlot) {
        throw new Error(`Slot ${slotNumber} no existe`);
      }
      if (targetSlot.status !== 'free') {
        throw new Error(`Slot ${slotNumber} ya está ocupado`);
      }
    } else {
      targetSlot = subBotDatabase.getFreeSlot();
      if (!targetSlot) {
        throw new Error('No hay slots disponibles');
      }
    }

    if (!subBotDatabase.isPublicRequestsEnabled() && !isOwnerRequest) {
      throw new Error('Las solicitudes de subbot están desactivadas');
    }

    const reserved = subBotDatabase.reserveSlot(targetSlot.slot, cleanPhone, ownerName);

    if (!reserved) {
      throw new Error('No se pudo reservar el slot');
    }

    const subBotId = randomBytes(8).toString('hex');
    const name = `VaniaBot-${ownerName.slice(0, 10)}`;

    const subConfig = subBotDatabase.activateSlot(
      targetSlot.slot,
      subBotId,
      ownerJid,
      ownerName,
      cleanPhone,
      name,
    );

    if (!subConfig) {
      throw new Error('No se pudo activar el slot');
    }

    const slot = subBotDatabase.getSlot(targetSlot.slot);
    if (!slot) {
      throw new Error('No se encontró el slot');
    }
    slot.status = 'pending';
    subBotDatabase.save();

    await this.launchInstance(subConfig);

    const instance = this.instances.get(subBotId);
    if (instance?.pairingCode) {
      return { slot, subConfig, pairingCode: instance.pairingCode };
    }

    return { slot, subConfig };
  }

  private buildMiddlewares(subBotId: string): MiddlewareConfig[] {
    logger.debug(`🔧 SubBot[${subBotId}] construyendo pipeline de middlewares...`);
    const mws: MiddlewareConfig[] = [
      { middleware: new AutoRegisterMiddleware(), priority: 1, canRunParallel: false },
      { middleware: new VaniaToggleMiddleware(), priority: 2, canRunParallel: false },
      { middleware: new MuteMiddleware(), priority: 3, canRunParallel: false },
      { middleware: new LoggerMiddleware(), priority: 4, canRunParallel: true },
      { middleware: new ValidationMiddleware(commandRegistry), priority: 5, canRunParallel: true },
      { middleware: new PermissionMiddleware(commandRegistry), priority: 6, canRunParallel: false },
      { middleware: new AntiSpamMiddleware(), priority: 7, canRunParallel: false },
      { middleware: new CooldownMiddleware(commandRegistry), priority: 8, canRunParallel: false },
    ];
    mws.sort((a, b) => a.priority - b.priority);
    logger.debug(`✅ SubBot[${subBotId}] pipeline listo (${mws.length} middlewares)`);
    return mws;
  }

  private getOrCreateRuntimeState(subBotId: string): BotRuntimeState {
    let state = this.runtimeStates.get(subBotId);
    if (!state) {
      state = this.loadRuntimeState(subBotId) || {
        id: subBotId,
        recentMessageIds: new Map(),
        contactNameCache: new Map(),
        lastProfileAppliedAt: 0,
        lastProfileSignature: '',
      };
      this.runtimeStates.set(subBotId, state);
    }
    return state;
  }

  private getRuntimeStateFile(botId: string): string {
    return `${SUBBOT_CONFIG.RUNTIME_STATE_DIR}/${botId}.json`;
  }

  private loadRuntimeState(botId: string): BotRuntimeState | null {
    const file = this.getRuntimeStateFile(botId);
    if (!existsSync(file)) return null;

    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const updatedAt = data?.updatedAt || 0;
      if (Date.now() - updatedAt > SUBBOT_CONFIG.BOT_RUNTIME_STATE_TTL_MS) {
        return null;
      }

      return {
        id: data.id,
        recentMessageIds: new Map(data.recentMessageIds || []),
        contactNameCache: new Map(
          (data.contactNameCache || []).map(([k, v]: [string, ContactCacheEntry]) => [k, v]),
        ),
        lastProfileAppliedAt: data.lastProfileAppliedAt || 0,
        lastProfileSignature: data.lastProfileSignature || '',
        pairingPendingAt: data.pairingPendingAt,
      };
    } catch {
      return null;
    }
  }

  private scheduleRuntimeStateWrite(botState: BotRuntimeState): void {
    const file = this.getRuntimeStateFile(botState.id);
    const data = {
      id: botState.id,
      recentMessageIds: Array.from(botState.recentMessageIds.entries()),
      contactNameCache: Array.from(botState.contactNameCache.entries()),
      lastProfileAppliedAt: botState.lastProfileAppliedAt,
      lastProfileSignature: botState.lastProfileSignature,
      pairingPendingAt: botState.pairingPendingAt,
      updatedAt: Date.now(),
    };

    try {
      const tmpFile = `${file}.tmp`;
      writeFileSync(tmpFile, JSON.stringify(data));
      renameSync(tmpFile, file);
    } catch (error) {
      logger.debug(`Runtime state write failed: ${error}`);
    }
  }

  private markAndCheckRecentMessage(subBotId: string, raw: WAMessage): boolean {
    const botState = this.runtimeStates.get(subBotId);
    if (!botState) return false;

    const { remoteJid, participant, id } = raw.key;
    if (!remoteJid || !id) return false;

    const key = `${remoteJid}|${participant || ''}|${id}`;
    const now = Date.now();

    const messageIds = botState.recentMessageIds;
    for (const [savedKey, savedAt] of messageIds) {
      if (now - savedAt > SUBBOT_CONFIG.MESSAGE_DEDUP_TTL_MS) {
        messageIds.delete(savedKey);
      }
    }

    const existingAt = messageIds.get(key);
    if (existingAt && now - existingAt <= SUBBOT_CONFIG.MESSAGE_DEDUP_TTL_MS) {
      return true;
    }

    messageIds.set(key, now);

    while (messageIds.size > SUBBOT_CONFIG.MESSAGE_DEDUP_MAX_ENTRIES) {
      const oldestKey = messageIds.keys().next().value;
      if (oldestKey) messageIds.delete(oldestKey);
      else break;
    }

    return false;
  }

  private getStoreContactName(subBotId: string, sock: WASocket, ...ids: string[]): string {
    const botState = this.runtimeStates.get(subBotId);
    if (!botState) return '';

    const contacts = (sock as unknown as { store?: { contacts?: Record<string, unknown> } }).store
      ?.contacts;
    if (!contacts) return '';

    const now = Date.now();
    const cacheKeys: string[] = [];

    for (const value of ids) {
      if (!value) continue;
      const normalized = this.normalizeJidUser(value);
      cacheKeys.push(value.toLowerCase());
      if (normalized) {
        cacheKeys.push(normalized.toLowerCase());
        cacheKeys.push(`${normalized}@s.whatsapp.net`.toLowerCase());
      }
    }

    const cache = botState.contactNameCache;
    for (const key of cacheKeys) {
      const cached = cache.get(key);
      if (cached && now - cached.cachedAt <= SUBBOT_CONFIG.CONTACT_CACHE_TTL_MS) {
        cache.delete(key);
        cache.set(key, cached);
        return cached.name;
      }
      cache.delete(key);
    }

    for (const value of ids) {
      if (!value) continue;
      const normalized = this.normalizeJidUser(value);
      const candidates = [value];
      if (normalized) {
        candidates.push(`${normalized}@s.whatsapp.net`);
      }

      for (const candidate of candidates) {
        const entry = contacts?.[candidate] as
          | {
              notify?: string;
              name?: string;
              verifiedName?: string;
            }
          | undefined;
        const name = entry?.notify || entry?.name || entry?.verifiedName || '';

        if (name) {
          const cacheEntry = { name, cachedAt: now };
          for (const key of cacheKeys) {
            cache.set(key, cacheEntry);
          }

          while (cache.size > SUBBOT_CONFIG.CONTACT_CACHE_MAX_ENTRIES) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey) cache.delete(oldestKey);
            else break;
          }

          return name;
        }
      }
    }

    return '';
  }

  private normalizeJidUser(value: string): string {
    return value.replace(/\D/g, '');
  }

  private async applyConfiguredProfile(subBotId: string, sock: WASocket): Promise<void> {
    const botState = this.runtimeStates.get(subBotId);
    const subConfig = subBotDatabase.get(subBotId);
    if (!botState || !subConfig || !sock?.user?.id) return;

    const desiredName = subConfig.name || `VaniaBot`;
    const desiredBio = subConfig.bio || `VaniaBot Subbot activo ✨`;
    const desiredPhoto = subConfig.photo || null;

    const signature = JSON.stringify({ desiredName, desiredBio, desiredPhoto });

    if (
      botState.lastProfileSignature === signature &&
      Date.now() - botState.lastProfileAppliedAt < 10 * 60 * 1000
    ) {
      return;
    }

    try {
      if (desiredName && typeof sock.updateProfileName === 'function') {
        await sock.updateProfileName(desiredName);
      }
      if (desiredBio && typeof sock.updateProfileStatus === 'function') {
        await sock.updateProfileStatus(desiredBio);
      }
      if (desiredPhoto && typeof sock.updateProfilePicture === 'function') {
        await sock.updateProfilePicture(sock.user.id, { url: desiredPhoto });
      }

      botState.lastProfileSignature = signature;
      botState.lastProfileAppliedAt = Date.now();
      this.scheduleRuntimeStateWrite(botState);
    } catch (error) {
      logger.warn(`SubBot[${subBotId}] profile apply failed: ${error}`);
    }
  }

  private async launchInstance(subConfig: SubBotConfig): Promise<void> {
    const toggleBotId = `subbot${subConfig.slot}`;

    if (this.instances.has(subConfig.id)) {
      logger.debug(`🔄 SubBot[${subConfig.id}] deteniendo instancia anterior...`);
      await this.instances.get(subConfig.id)?.stop();
      this.instances.delete(subConfig.id);
      this.middlewaresPerInstance.delete(subConfig.id);
      this.antiSpamPerInstance.delete(subConfig.id);
    }

    this.getOrCreateRuntimeState(subConfig.id);
    const middlewares = this.buildMiddlewares(subConfig.id);
    this.middlewaresPerInstance.set(subConfig.id, middlewares);

    const antiSpam = new AntiSpamService();
    antiSpam.startCleanup();
    this.antiSpamPerInstance.set(subConfig.id, antiSpam);

    const instance = new SubBotInstance(subConfig);
    const runtimeState = this.runtimeStates.get(subConfig.id);
    if (!runtimeState) {
      throw new Error('No se encontró el estado de runtime');
    }
    runtimeState.pairingPendingAt = Date.now();
    this.scheduleRuntimeStateWrite(runtimeState);

    let pairingCodeTimeout: ReturnType<typeof setTimeout> | undefined;

    instance.on('pairingCode', (code: string) => {
      void (async () => {
        if (pairingCodeTimeout) {
          clearTimeout(pairingCodeTimeout);
        }

        if (!this.mainSock) return;
        logger.info(`🔑 SubBot[${subConfig.id}] enviando código a ${subConfig.ownerJid}`);

        runtimeState.pairingPendingAt = Date.now();
        this.scheduleRuntimeStateWrite(runtimeState);

        try {
          await this.mainSock.sendMessage(subConfig.ownerJid, {
            text:
              `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
              `   *Vincular SubBot*\n` +
              `\n` +
              `💝 Tu SubBot está lista\n` +
              `   para conectarse.\n` +
              `\n` +
              `*Código de vinculación*\n` +
              `╭───────────────╮\n` +
              `│    *${code}*    │\n` +
              `╰───────────────╯\n` +
              `\n` +
              `✨ *Cómo vincularla*\n` +
              `1️⃣ Abre *WhatsApp* en\n` +
              `   el teléfono de la SubBot\n` +
              `2️⃣ Ve a *Dispositivos vinculados*\n` +
              `3️⃣ Toca *Vincular dispositivo*\n` +
              `4️⃣ Ingresa el código de arriba\n` +
              `\n` +
              `⏳ El código expira\n` +
              `   en *3 minutos*\n` +
              `\n` +
              `Número:\n` +
              `   *+${subConfig.phoneNumber}*\n` +
              `\n` +
              `   Estaré esperando 💗\n` +
              `╰━━━━━━━━━━━━━━━━━━━━╯`,
          });

          pairingCodeTimeout = setTimeout(() => {
            void (async () => {
              const slot = subBotDatabase.getSlot(subConfig.slot);
              if (
                slot &&
                (slot.status === 'pending' || slot.status === 'linking') &&
                this.mainSock
              ) {
                logger.warn(`⏰ SubBot[${subConfig.id}] código no utilizado, reenviando...`);
                try {
                  await this.mainSock.sendMessage(subConfig.ownerJid, {
                    text:
                      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
                      `   *Recordatorio SubBot*\n` +
                      `\n` +
                      `⏰ El código anterior\n` +
                      `   quizás expiró.\n` +
                      `\n` +
                      `✨ Usa *.reconbot*\n` +
                      `   para generar uno nuevo.\n` +
                      `\n` +
                      `   Estoy aquí 💗\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━╯`,
                  });
                } catch (error) {
                  logError('[SubBotManager]', error);
                }
              }
            })();
          }, 180000);
        } catch (e) {
          logError(`SubBot[${subConfig.id}].sendPairingCode`, e);
        }
      })();
    });

    instance.on('ready', () => {
      void (async () => {
        if (pairingCodeTimeout) {
          clearTimeout(pairingCodeTimeout);
          pairingCodeTimeout = undefined;
        }
        if (!this.mainSock) return;
        logger.info(`🎉 SubBot[${subConfig.id}] lista, notificando owner`);

        if (!subConfig.ownerJid) {
          logger.warn(`SubBot[${subConfig.id}] sin ownerJid, saltando notificación`);
          return;
        }

        runtimeState.pairingPendingAt = undefined;
        subBotDatabase.updateSlotStatus(subConfig.slot, 'connected');
        this.scheduleRuntimeStateWrite(runtimeState);

        try {
          // Guard: if the socket is not ready yet, skip preload instead of
          // racing `undefined` against the timeout (which resolves instantly).
          const preloadPromise = instance.sock
            ? instance.sock.groupFetchAllParticipating()
            : Promise.reject(new Error('Socket not ready'));
          const groups = await Promise.race([
            preloadPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timed Out')), 10000),
            ),
          ]);
          if (groups) {
            const groupIds = Object.keys(groups);
            logger.debug(`🔥 SubBot[${subConfig.id}] precargando ${groupIds.length} grupos...`);
            await Promise.allSettled(
              groupIds.map(gid => serviceManager.groupService.getGroup(gid)),
            );
            logger.debug(`✅ SubBot[${subConfig.id}] grupos precargados`);
          }
        } catch (e) {
          logger.warn(
            `⚠️ SubBot[${subConfig.id}] preloadGroups: ${e instanceof Error ? e.message : e}`,
          );
        }

        setTimeout(() => {
          if (instance.sock) {
            void this.applyConfiguredProfile(subConfig.id, instance.sock);
          }
        }, SUBBOT_CONFIG.PROFILE_APPLY_DELAY_MS);

        try {
          await this.mainSock.sendMessage(subConfig.ownerJid, {
            text:
              `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
              `   🤖 *SubBot activada*\n` +
              `\n` +
              `💝 ¡Tu SubBot ya está\n` +
              `   lista para usarse!\n` +
              `\n` +
              `🏷️ Nombre:\n` +
              `   *${subConfig.name}*\n` +
              `\n` +
              `📁 Slot:\n` +
              `   *${subConfig.slot}*\n` +
              `\n` +
              `Número:\n` +
              `   *+${subConfig.phoneNumber}*\n` +
              `\n` +
              `Prefijo:\n` +
              `   *${config.prefix}*\n` +
              `\n` +
              `   ¡Disfrútala! 💗\n` +
              `╰━━━━━━━━━━━━━━━━━━━━╯`,
          });
        } catch (e) {
          logError(`SubBot[${subConfig.id}].sendReady`, e);
        }
      })();
    });

    instance.on('sessionInvalid', () => {
      void (async () => {
        if (!this.mainSock) return;
        logger.warn(`⚠️ SubBot[${subConfig.id}] sesión inválida, limpiando y notificando owner`);

        subBotDatabase.updateSlotStatus(subConfig.slot, 'disconnected');

        const sessionPath = `${SUBBOT_CONFIG.SESSION_BASE_PATH}/${subConfig.id}`;
        if (existsSync(sessionPath)) {
          try {
            rmSync(sessionPath, { recursive: true, force: true });
            logger.info(`🗑️ SubBot[${subConfig.id}] sesión corrupta eliminada de ${sessionPath}`);
          } catch (err) {
            logger.warn(`SubBot[${subConfig.id}] no se pudo limpiar sesión: ${err}`);
          }
        }

        try {
          await this.mainSock.sendMessage(subConfig.ownerJid, {
            text:
              `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
              `   *SubBot desconectada*\n` +
              `\n` +
              `Parece que tu SubBot\n` +
              `   se ha desconectado.\n` +
              `\n` +
              `Probablemente la sesión\n` +
              `   se cerró desde el\n` +
              `   teléfono.\n` +
              `\n` +
              `Para volver a conectarla\n` +
              `   usa:\n` +
              `\n` +
              `   *.reconbot*\n` +
              `\n` +
              `   Estoy aquí 💗\n` +
              `╰━━━━━━━━━━━━━━━━━━━━╯`,
          });
        } catch (error) {
          logError('[SubBotManager]', error);
        }
      })();
    });

    instance.on('disconnected', () => {
      subBotDatabase.updateSlotStatus(subConfig.slot, 'disconnected');
    });

    instance.on('message', (msg: WAMessage, sock: WASocket) => {
      void this.messageHandler
        .handleMessage(msg, sock, subConfig)
        .catch(err => logError(`SubBotManager[${subConfig.id}].handleSubBotMessage`, err));
    });

    instance.on('groupUpdate', (update: BaileysEventMap['group-participants.update']) => {
      if (instance.sock) {
        void this.messageHandler
          .handleGroupUpdate(update, instance.sock, toggleBotId)
          .catch(err => logError(`SubBotManager[${subConfig.id}].handleGroupUpdate`, err));
      }
    });

    this.instances.set(subConfig.id, instance);
    subBotDatabase.updateSlotStatus(subConfig.slot, 'linking');
    await instance.start();
    logger.info(`✅ SubBot[${subConfig.id}] instancia lanzada en slot ${subConfig.slot}`);
  }

  async stopSubBot(ownerJid: string): Promise<void> {
    const slot = subBotDatabase.getOwnerSlots(ownerJid).find(s => s.status === 'connected');
    if (!slot || !slot.id) throw new Error('No tienes una subbot activa.');

    logger.info(`🛑 SubBot[${slot.id}] deteniendo por solicitud del owner`);
    const instance = this.instances.get(slot.id);
    if (instance) {
      await instance.stop();
      this.instances.delete(slot.id);
      this.middlewaresPerInstance.delete(slot.id);

      const antiSpam = this.antiSpamPerInstance.get(slot.id);
      if (antiSpam) {
        antiSpam.stopCleanup();
        this.antiSpamPerInstance.delete(slot.id);
      }
    }

    const botState = this.runtimeStates.get(slot.id);
    if (botState) {
      this.scheduleRuntimeStateWrite(botState);
      this.runtimeStates.delete(slot.id);
    }

    subBotDatabase.updateSlotStatus(slot.slot, 'disconnected');
  }

  async deleteSubBot(ownerJid: string, slotNumber?: number): Promise<void> {
    let slot: SubBotSlot | undefined;

    if (slotNumber) {
      const found = subBotDatabase.getSlot(slotNumber);
      if (found && found.ownerJid === ownerJid) {
        slot = found;
      }
    } else {
      const configs = subBotDatabase.getOwnerSlots(ownerJid);
      if (configs.length > 0) {
        const config = configs[0];
        slot = subBotDatabase.getOwnerSlotById(config.id) ?? undefined;
      }
    }

    if (!slot || !slot.id) throw new Error('No tienes una subbot en ese slot.');

    logger.info(`🗑️ SubBot[${slot.id}] eliminando...`);
    const instance = this.instances.get(slot.id);
    if (instance) {
      await instance.stop();
      this.instances.delete(slot.id);
      this.middlewaresPerInstance.delete(slot.id);

      const antiSpam = this.antiSpamPerInstance.get(slot.id);
      if (antiSpam) {
        antiSpam.stopCleanup();
        this.antiSpamPerInstance.delete(slot.id);
      }
    }

    if (existsSync(`${SUBBOT_CONFIG.SESSION_BASE_PATH}/${slot.id}`)) {
      try {
        rmSync(`${SUBBOT_CONFIG.SESSION_BASE_PATH}/${slot.id}`, { recursive: true, force: true });
      } catch (error) {
        logError('[SubBotManager]', error);
      }
    }

    const runtimeFile = this.getRuntimeStateFile(slot.id);
    if (existsSync(runtimeFile)) {
      try {
        rmSync(runtimeFile, { force: true });
      } catch (error) {
        logError('[SubBotManager]', error);
      }
    }

    const botState = this.runtimeStates.get(slot.id);
    if (botState) {
      this.runtimeStates.delete(slot.id);
    }

    subBotDatabase.releaseSlot(slot.slot);
    logger.info(`✅ Slot ${slot.slot} liberado completamente`);
  }

  async reconnectByOwner(ownerJid: string, slotNumber?: number): Promise<void> {
    let slot: SubBotSlot | undefined;

    if (slotNumber) {
      const found = subBotDatabase.getSlot(slotNumber);
      if (found && found.ownerJid === ownerJid) {
        slot = found;
      }
    } else {
      const configs = subBotDatabase.getOwnerSlots(ownerJid);
      if (configs.length > 0) {
        const config = configs[0];
        slot = subBotDatabase.getOwnerSlotById(config.id) ?? undefined;
      }
    }

    if (!slot || !slot.id) throw new Error('No tienes una subbot para reconectar.');

    logger.info(`🔄 SubBot[${slot.id}] reconectando...`);

    const instance = this.instances.get(slot.id);
    if (instance) {
      await instance.stop();
      this.instances.delete(slot.id);
      this.middlewaresPerInstance.delete(slot.id);

      const antiSpam = this.antiSpamPerInstance.get(slot.id);
      if (antiSpam) {
        antiSpam.stopCleanup();
        this.antiSpamPerInstance.delete(slot.id);
      }
    }

    const botState = this.runtimeStates.get(slot.id);
    if (botState) {
      botState.pairingPendingAt = Date.now();
      this.scheduleRuntimeStateWrite(botState);
    }

    subBotDatabase.updateSlotStatus(slot.slot, 'pending');

    const subConfig = subBotDatabase.get(slot.id);
    if (!subConfig) {
      throw new Error('Configuración no encontrada');
    }

    await this.launchInstance(subConfig);
  }

  async resetSlot(slotNumber: number): Promise<void> {
    const slot = subBotDatabase.getSlot(slotNumber);
    if (!slot || !slot.id) throw new Error('Slot no encontrado o vacío.');

    logger.info(`🔄 Slot[${slotNumber}] reseteando sesión...`);

    const instance = this.instances.get(slot.id);
    if (instance) {
      await instance.stop();
      this.instances.delete(slot.id);
      this.middlewaresPerInstance.delete(slot.id);

      const antiSpam = this.antiSpamPerInstance.get(slot.id);
      if (antiSpam) {
        antiSpam.stopCleanup();
        this.antiSpamPerInstance.delete(slot.id);
      }
    }

    try {
      rmSync(`${SUBBOT_CONFIG.SESSION_BASE_PATH}/${slot.id}`, { recursive: true, force: true });
    } catch (error) {
      logError('[SubBotManager]', error);
    }

    const runtimeFile = this.getRuntimeStateFile(slot.id);
    if (existsSync(runtimeFile)) {
      try {
        rmSync(runtimeFile, { force: true });
      } catch (error) {
        logError('[SubBotManager]', error);
      }
    }

    const botState = this.runtimeStates.get(slot.id);
    if (botState) {
      this.runtimeStates.delete(slot.id);
    }

    slot.id = undefined;
    slot.status = 'free';
    slot.connectedAt = undefined;
    subBotDatabase.save();

    logger.info(`✅ Slot[${slotNumber}] reseteado`);
  }

  getStatus(ownerJid: string, slotNumber?: number): SubBotSlot | null {
    if (slotNumber) {
      const slot = subBotDatabase.getSlot(slotNumber);
      return slot && slot.ownerJid === ownerJid ? slot : null;
    }
    const configs = subBotDatabase.getOwnerSlots(ownerJid);
    if (configs.length > 0) {
      return subBotDatabase.getOwnerSlotById(configs[0].id) ?? null;
    }
    return null;
  }

  getAllStatus(): SubBotSlot[] {
    return subBotDatabase.getAllSlots();
  }

  getTotalConnected(): number {
    return subBotDatabase.getActiveSlots().filter(s => s.status === 'connected').length;
  }

  getSlotInfo(slotNumber: number): SubBotSlot | undefined {
    return subBotDatabase.getSlot(slotNumber);
  }

  async shutdown(): Promise<void> {
    logger.info(`🛑 SubBotManager cerrando ${this.instances.size} subbots...`);
    this.stopHealthCheck();
    this.stopSettingsSync();

    for (const [, botState] of this.runtimeStates) {
      this.scheduleRuntimeStateWrite(botState);
    }

    const stops = Array.from(this.instances.values()).map(i => i.stop());
    await Promise.allSettled(stops);

    this.instances.clear();
    this.middlewaresPerInstance.clear();
    this.antiSpamPerInstance.clear();
    this.runtimeStates.clear();

    logger.info('✅ SubBotManager cerrada');
  }
}

export const subBotManager = SubBotManager.getInstance();
