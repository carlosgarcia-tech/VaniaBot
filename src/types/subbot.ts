/**
 * subbot.ts
 *
 * Types describing the sub-bot subsystem: slot allocation, bot records and the
 * messages exchanged between the main bot and its secondary sessions.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

/**
 * Lifecycle of a numbered slot.
 *
 * `free` -> `reserved` -> `pending` -> `linking` -> `connected`, with
 * `disconnected` reachable from any active state when the session drops.
 */
export type SubBotSlotStatus =
  'free' | 'reserved' | 'pending' | 'linking' | 'connected' | 'disconnected';

/** Older connection-status shape kept for records written before slot tracking. */
export type SubBotLegacyStatus = 'pending' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Full sub-bot record as persisted. */
export interface SubBotConfig {
  id: string;
  ownerJid: string;
  ownerName: string;
  phoneNumber: string;
  sessionPath: string;
  prefix: string;
  name: string;
  active: boolean;
  createdAt: number;
  connectedAt?: number;
  status: SubBotLegacyStatus;
  pairingCode?: string;
  pairingCodeRequestedAt?: number;
  slot: number;
  label: string;
  bio?: string;
  photo?: string;
  requesterNumber?: string;
  requestedAt?: number;
  releasedAt?: number;
}

/** A numbered slot, occupied or not. All identity fields are optional while free. */
export interface SubBotSlot {
  slot: number;
  id?: string;
  ownerJid?: string;
  ownerName?: string;
  phoneNumber?: string;
  name?: string;
  status: SubBotSlotStatus;
  requesterNumber?: string;
  requestedAt?: number;
  releasedAt?: number;
  connectedAt?: number;
  bio?: string;
  photo?: string;
}

/** Cached display name for a JID, used to avoid repeated metadata lookups. */
export interface ContactCacheEntry {
  name: string;
  cachedAt: number;
}

/**
 * Volatile per-session state kept in memory while a sub-bot runs.
 * Not persisted as a whole: it is snapshotted selectively so a restart can
 * rebuild context without restoring stale timers or handles.
 */
export interface BotRuntimeState {
  id: string;
  recentMessageIds: Map<string, number>;
  contactNameCache: Map<string, ContactCacheEntry>;
  lastProfileAppliedAt: number;
  lastProfileSignature: string;
  pairingPendingAt?: number;
}

/** Envelope used to pass events between the main bot and a sub-bot instance. */
export interface SubBotMessage {
  type: 'command' | 'status' | 'pairingCode' | 'error' | 'ready';
  subBotId: string;
  payload: unknown;
}

/** Public status view of a sub-bot, safe to return from commands and the panel. */
export interface SubBotStatus {
  id: string;
  status: SubBotSlotStatus;
  name: string;
  phoneNumber: string;
  ownerJid: string;
  slot: number;
  connectedAt?: number;
}
