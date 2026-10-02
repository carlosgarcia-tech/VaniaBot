/**
 * SubBot status types.
 */
export type SubBotSlotStatus =
  'free' | 'reserved' | 'pending' | 'linking' | 'connected' | 'disconnected';

/**
 * Legacy SubBot status types.
 */
export type SubBotLegacyStatus = 'pending' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * SubBot configuration interface.
 */
export interface SubBotConfig {
  /** Unique bot ID */
  id: string;
  /** Owner JID */
  ownerJid: string;
  /** Owner display name */
  ownerName: string;
  /** Phone number */
  phoneNumber: string;
  /** Session storage path */
  sessionPath: string;
  /** Command prefix */
  prefix: string;
  /** Bot display name */
  name: string;
  /** Whether the bot is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Connection timestamp */
  connectedAt?: number;
  /** Current status */
  status: SubBotLegacyStatus;
  /** Pairing code if applicable */
  pairingCode?: string;
  /** When pairing code was requested */
  pairingCodeRequestedAt?: number;
  /** Slot number */
  slot: number;
  /** Slot label */
  label: string;
  /** Bio text */
  bio?: string;
  /** Profile photo URL */
  photo?: string;
  /** Requester phone number */
  requesterNumber?: string;
  /** Request timestamp */
  requestedAt?: number;
  /** Release timestamp */
  releasedAt?: number;
}

/**
 * SubBot slot information.
 */
export interface SubBotSlot {
  /** Slot number */
  slot: number;
  /** Bot ID if occupied */
  id?: string;
  /** Owner JID */
  ownerJid?: string;
  /** Owner name */
  ownerName?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Bot name */
  name?: string;
  /** Slot status */
  status: SubBotSlotStatus;
  /** Requester phone number */
  requesterNumber?: string;
  /** Request timestamp */
  requestedAt?: number;
  /** Release timestamp */
  releasedAt?: number;
  /** Connection timestamp */
  connectedAt?: number;
  /** Bio text */
  bio?: string;
  /** Profile photo URL */
  photo?: string;
}

/**
 * Contact cache entry.
 */
export interface ContactCacheEntry {
  /** Contact name */
  name: string;
  /** Cache timestamp */
  cachedAt: number;
}

/**
 * Bot runtime state.
 */
export interface BotRuntimeState {
  /** Bot ID */
  id: string;
  /** Recent message IDs with timestamps */
  recentMessageIds: Map<string, number>;
  /** Contact name cache */
  contactNameCache: Map<string, ContactCacheEntry>;
  /** Last profile applied timestamp */
  lastProfileAppliedAt: number;
  /** Last profile signature */
  lastProfileSignature: string;
  /** Pending pairing timestamp */
  pairingPendingAt?: number;
}

/**
 * SubBot inter-process message.
 */
export interface SubBotMessage {
  /** Message type */
  type: 'command' | 'status' | 'pairingCode' | 'error' | 'ready';
  /** SubBot ID */
  subBotId: string;
  /** Message payload */
  payload: unknown;
}

/**
 * SubBot status information.
 */
export interface SubBotStatus {
  /** Bot ID */
  id: string;
  /** Current status */
  status: SubBotSlotStatus;
  /** Bot name */
  name: string;
  /** Phone number */
  phoneNumber: string;
  /** Owner JID */
  ownerJid: string;
  /** Slot number */
  slot: number;
  /** Connection timestamp */
  connectedAt?: number;
}