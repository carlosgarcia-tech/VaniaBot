/**
 * SubBotDatabase.ts
 *
 * SQLite-based database manager for subbots with slot system.
 * Handles up to 50 slots numbered 1-50.
 *
 * @author **Carlos G**
 * @created 2026-03-16
 */

import { getDatabase } from '@/repositories/Database.js';
import { SUBBOT_CONFIG } from '@/config/subbot.js';
import type { SubBotConfig, SubBotSlot, SubBotSlotStatus } from '@/types/subbot.js';
import { logger } from '@/utils/logger.js';

const MAX_SLOTS_LIMIT = 50;
const DEFAULT_MAX_SLOTS = 10;

export interface SubBotSettings {
  maxSlots: number;
  publicRequests: boolean;
}

export class SubBotDatabase {
  private static instance: SubBotDatabase;
  private slotCache: Map<number, SubBotSlot> = new Map();
  private configCache: Map<string, SubBotConfig> = new Map();
  private settingsCache: SubBotSettings = {
    maxSlots: DEFAULT_MAX_SLOTS,
    publicRequests: true,
  };
  private initialized = false;

  private constructor() {}

  static getInstance(): SubBotDatabase {
    if (!SubBotDatabase.instance) {
      SubBotDatabase.instance = new SubBotDatabase();
    }
    return SubBotDatabase.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.loadSettings();
    this.loadSlots();
    this.initialized = true;
    logger.debug('[SubBotDatabase] SQLite-based database initialized');
  }

  private loadSettings(): void {
    try {
      const maxSlots = getDatabase().fetchOne<{ value: string }>(
        "SELECT value FROM subbot_settings WHERE key = 'maxSlots'",
      );
      const publicRequests = getDatabase().fetchOne<{ value: string }>(
        "SELECT value FROM subbot_settings WHERE key = 'publicRequests'",
      );

      this.settingsCache = {
        maxSlots: maxSlots ? parseInt(maxSlots.value, 10) : DEFAULT_MAX_SLOTS,
        publicRequests: publicRequests ? publicRequests.value === 'true' : true,
      };
    } catch {
      this.settingsCache = {
        maxSlots: DEFAULT_MAX_SLOTS,
        publicRequests: true,
      };
    }
  }

  private loadSlots(): void {
    try {
      const slots = getDatabase().fetchAll<SubBotSlot>(
        'SELECT * FROM subbot_slots ORDER BY slot_number ASC',
      );

      this.slotCache.clear();
      this.configCache.clear();

      if (slots.length === 0) {
        logger.debug('[SubBotDatabase] No slots in DB, creating defaults');
        for (let i = 1; i <= MAX_SLOTS_LIMIT; i++) {
          const slot: SubBotSlot = {
            slot: i,
            status: 'free',
          };
          this.slotCache.set(i, slot);
          getDatabase().query(
            'INSERT OR IGNORE INTO subbot_slots (slot_number, status) VALUES (?, ?)',
            { params: [i, 'free'] },
          );
        }
        getDatabase().forceSave();
        logger.debug('[SubBotDatabase] Created 50 default slots');
        return;
      }

      for (const slot of slots) {
        this.slotCache.set(slot.slot, slot);

        if (slot.id) {
          const config = this.mapSlotToConfig(slot);
          if (config) {
            this.configCache.set(config.id, config);
          }
        }
      }
    } catch (_error) {
      logger.warn('[SubBotDatabase] Failed to load slots, using defaults');
      for (let i = 1; i <= MAX_SLOTS_LIMIT; i++) {
        this.slotCache.set(i, {
          slot: i,
          status: 'free',
        });
      }
    }
  }

  private mapSlotToConfig(slot: SubBotSlot): SubBotConfig | undefined {
    if (!slot.id) return undefined;

    return {
      id: slot.id,
      ownerJid: slot.ownerJid || '',
      ownerName: slot.ownerName || '',
      phoneNumber: slot.phoneNumber || '',
      sessionPath: `${SUBBOT_CONFIG.SESSION_BASE_PATH}/${slot.id}`,
      prefix: '.',
      name: slot.name || `VaniaBot-${slot.slot}`,
      active: slot.status === 'connected',
      createdAt: slot.requestedAt || Date.now(),
      connectedAt: slot.connectedAt,
      status: this.mapSlotStatusToLegacy(slot.status),
      slot: slot.slot,
      label: `SUBBOT${slot.slot}`,
      bio: slot.bio,
      photo: slot.photo,
      requesterNumber: slot.requesterNumber,
      requestedAt: slot.requestedAt,
      releasedAt: slot.releasedAt,
    };
  }

  private mapSlotStatusToLegacy(
    status: SubBotSlotStatus,
  ): 'pending' | 'connecting' | 'connected' | 'disconnected' | 'error' {
    switch (status) {
      case 'connected':
        return 'connected';
      case 'linking':
      case 'pending':
      case 'reserved':
        return 'connecting';
      case 'disconnected':
        return 'disconnected';
      default:
        return 'pending';
    }
  }

  getSlot(slotNumber: number): SubBotSlot | undefined {
    return this.slotCache.get(slotNumber);
  }

  getFreeSlot(): SubBotSlot | undefined {
    for (const [, slot] of this.slotCache) {
      if (slot.status === 'free' && slot.slot <= this.settingsCache.maxSlots) {
        return slot;
      }
    }
    return undefined;
  }

  getAllSlots(): SubBotSlot[] {
    return Array.from(this.slotCache.values());
  }

  getAll(): SubBotConfig[] {
    return Array.from(this.configCache.values());
  }

  getActive(): SubBotConfig[] {
    return this.getAll().filter(s => s.active || s.status === 'connected');
  }

  get(subBotId: string): SubBotConfig | undefined {
    return this.configCache.get(subBotId);
  }

  getUsedSlotCount(): number {
    let count = 0;
    for (const [, slot] of this.slotCache) {
      if (slot.status !== 'free') count++;
    }
    return count;
  }

  getMaxSlots(): number {
    return this.settingsCache.maxSlots;
  }

  isPublicRequestsEnabled(): boolean {
    return this.settingsCache.publicRequests;
  }

  updateSlotStatus(slotNumber: number, status: SubBotSlotStatus): void {
    const slot = this.getSlot(slotNumber);
    if (!slot) return;

    const updatedSlot: SubBotSlot = {
      ...slot,
      status,
      connectedAt: status === 'connected' ? Date.now() : slot.connectedAt,
    };

    this.slotCache.set(slotNumber, updatedSlot);

    try {
      const sets: string[] = ['status = ?'];
      const params: unknown[] = [status];

      if (status === 'connected') {
        sets.push('connected_at = ?');
        params.push(new Date().toISOString());
      }

      params.push(slotNumber);

      getDatabase().query(`UPDATE subbot_slots SET ${sets.join(', ')} WHERE slot_number = ?`, {
        params,
      });
    } catch (error) {
      logger.error('[SubBotDatabase] Failed to update slot status:', error);
    }
  }

  activateSlot(
    slotNumber: number,
    botId: string,
    ownerJid: string,
    ownerName: string,
    phoneNumber: string,
    name: string,
  ): SubBotConfig | null {
    const slot = this.getSlot(slotNumber);
    if (!slot) return null;

    const now = new Date().toISOString();

    try {
      getDatabase().query(
        `UPDATE subbot_slots 
         SET bot_id = ?, owner_jid = ?, owner_name = ?, phone_number = ?, name = ?, status = 'pending', requested_at = ?
         WHERE slot_number = ?`,
        { params: [botId, ownerJid, ownerName, phoneNumber, name, now, slotNumber] },
      );

      const updatedSlot: SubBotSlot = {
        ...slot,
        id: botId,
        ownerJid,
        ownerName,
        phoneNumber,
        name,
        status: 'pending',
        requestedAt: Date.now(),
      };

      this.slotCache.set(slotNumber, updatedSlot);

      const config = this.mapSlotToConfig(updatedSlot);
      if (config) {
        this.configCache.set(config.id, config);
        return config;
      }
      return null;
    } catch {
      return null;
    }
  }

  releaseSlot(slotNumber: number): void {
    const slot = this.getSlot(slotNumber);
    if (!slot) return;

    const now = new Date().toISOString();

    try {
      getDatabase().query(
        `UPDATE subbot_slots 
         SET bot_id = NULL, owner_jid = NULL, owner_name = NULL, phone_number = NULL, name = NULL, 
         status = 'free', requester_number = NULL, released_at = ?, connected_at = NULL
         WHERE slot_number = ?`,
        { params: [now, slotNumber] },
      );

      this.slotCache.set(slotNumber, {
        slot: slotNumber,
        status: 'free',
      });

      if (slot.id) {
        this.configCache.delete(slot.id);
      }
    } catch (error) {
      logger.error('[SubBotDatabase] Failed to release slot:', error);
    }
  }

  clearCache(): void {
    this.slotCache.clear();
    this.configCache.clear();
  }

  update(subBotId: string, partial: Partial<SubBotConfig>): void {
    const config = this.configCache.get(subBotId);
    if (!config) return;

    const updated = { ...config, ...partial };
    this.configCache.set(subBotId, updated);

    const slot = this.getSlot(config.slot);
    if (slot) {
      if (partial.connectedAt !== undefined) slot.connectedAt = partial.connectedAt;
      if (partial.status !== undefined) {
        const statusMap: Record<string, SubBotSlotStatus> = {
          connected: 'connected',
          connecting: 'linking',
          pending: 'pending',
          disconnected: 'disconnected',
          error: 'disconnected',
        };
        slot.status = statusMap[partial.status] ?? 'free';
      }
      this.slotCache.set(config.slot, slot);
    }
  }

  getOwnerSlots(ownerJid: string): SubBotConfig[] {
    const result: SubBotConfig[] = [];
    for (const config of this.configCache.values()) {
      if (config.ownerJid === ownerJid) result.push(config);
    }
    return result;
  }

  getActiveSlots(): SubBotSlot[] {
    const result: SubBotSlot[] = [];
    for (const slot of this.slotCache.values()) {
      if (slot.status !== 'free') result.push(slot);
    }
    return result;
  }

  setPublicRequests(enabled: boolean): void {
    this.settingsCache.publicRequests = enabled;
    try {
      getDatabase().query("UPDATE subbot_settings SET value = ? WHERE key = 'publicRequests'", {
        params: [enabled ? 'true' : 'false'],
      });
    } catch (error) {
      logger.error('[SubBotDatabase] Failed to update publicRequests:', error);
    }
  }

  setMaxSlots(max: number): void {
    const safeMax = Math.max(1, Math.min(MAX_SLOTS_LIMIT, max));
    this.settingsCache.maxSlots = safeMax;
    try {
      getDatabase().query("UPDATE subbot_settings SET value = ? WHERE key = 'maxSlots'", {
        params: [safeMax.toString()],
      });
    } catch (error) {
      logger.error('[SubBotDatabase] Failed to update maxSlots:', error);
    }
  }

  reserveSlot(
    slotNumber: number,
    requesterNumber: string,
    requesterName: string,
  ): SubBotSlot | null {
    const slot = this.getSlot(slotNumber);
    if (!slot || slot.status !== 'free') return null;

    const now = new Date().toISOString();

    try {
      getDatabase().query(
        `UPDATE subbot_slots 
         SET status = 'reserved', requester_number = ?, owner_name = ?, requested_at = ?
         WHERE slot_number = ?`,
        { params: [requesterNumber, requesterName, now, slotNumber] },
      );

      const updatedSlot: SubBotSlot = {
        ...slot,
        status: 'reserved',
        requesterNumber,
        requestedAt: Date.now(),
      };

      this.slotCache.set(slotNumber, updatedSlot);
      return updatedSlot;
    } catch {
      return null;
    }
  }

  save(): void {
    getDatabase().forceSave();
  }

  getOwnerSlotById(botId: string): SubBotSlot | null {
    for (const slot of this.slotCache.values()) {
      if (slot.id === botId) return slot;
    }
    return null;
  }
}

export const subBotDatabase = SubBotDatabase.getInstance();
