export type SubBotSlotStatus =
  'free' | 'reserved' | 'pending' | 'linking' | 'connected' | 'disconnected';

export type SubBotLegacyStatus = 'pending' | 'connecting' | 'connected' | 'disconnected' | 'error';

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

export interface ContactCacheEntry {
  name: string;
  cachedAt: number;
}

export interface BotRuntimeState {
  id: string;
  recentMessageIds: Map<string, number>;
  contactNameCache: Map<string, ContactCacheEntry>;
  lastProfileAppliedAt: number;
  lastProfileSignature: string;
  pairingPendingAt?: number;
}

export interface SubBotMessage {
  type: 'command' | 'status' | 'pairingCode' | 'error' | 'ready';
  subBotId: string;
  payload: unknown;
}

export interface SubBotStatus {
  id: string;
  status: SubBotSlotStatus;
  name: string;
  phoneNumber: string;
  ownerJid: string;
  slot: number;
  connectedAt?: number;
}
