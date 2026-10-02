/**
 * index.ts
 *
 * Central configuration aggregator for VaniaBot.
 * Combines environment variables with application defaults.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { env } from './env.js';
import type { BotConfig } from '@/types/index.js';

/**
 * Bot configuration object aggregating all settings
 * @example
 * import { config } from '@/config/index.js';
 * console.log(config.name);
 */
export const VANIA_TOGGLE_COMMANDS: readonly string[] = ['vaniaon', 'vaniaoff', 'vaniastatus'];

export const config: BotConfig = {
  /** Bot display name */
  name: env.BOT_NAME,

  /** Command prefix */
  prefix: env.BOT_PREFIX,

  /** Array of owner JIDs (phone numbers and LID IDs) - unified from all sources */
  owners: [env.OWNER_JID, ...env.OWNERS, ...(env.OWNER_JIDS || [])].filter((jid): jid is string =>
    Boolean(jid?.trim()),
  ),

  /** Additional owner JIDs */
  ownerJids: env.OWNER_JIDS || [],

  /** Session storage directory path */
  sessionPath: env.SESSION_PATH,

  /** Authentication configuration */
  auth: {
    /** Use pairing code instead of QR code */
    usePairingCode: env.USE_PAIRING_CODE,
    /** Phone number for pairing code (with country code) */
    phoneNumber: env.PHONE_NUMBER,
  },

  /** Feature flags */
  features: {
    /** Enable anti-spam rate limiting */
    antiSpam: env.ANTI_SPAM,
    /** Automatically mark messages as read */
    autoRead: env.AUTO_READ,
    /** Enable bot to respond to itself */
    selfReply: env.SELF_REPLY,
    /** Enable in-memory caching */
    cacheEnabled: env.CACHE_ENABLED,
    /** Enable automatic reconnection */
    autoReconnect: env.AUTO_RECONNECT,
  },

  /** Rate limits and thresholds */
  limits: {
    /** Maximum commands per minute per user */
    maxCommandsPerMinute: env.MAX_COMMANDS_PER_MINUTE,
    /** Maximum media file size in bytes */
    maxMediaSize: env.MAX_MEDIA_SIZE,
    /** Maximum reconnection attempts */
    maxReconnectAttempts: env.MAX_RECONNECT_ATTEMPTS,
  },

  /** Database configuration */
  database: {
    /** Database type: 'json' or 'mongodb' */
    type: env.DB_TYPE,
    /** MongoDB connection URI (if using mongodb) */
    uri: env.DB_URI,
    /** JSON database file path */
    path: './data/database.json',
  },

  /** Rate limiting configuration */
  rateLimit: {
    maxMessagesPerGroup: env.GROUP_RATE_LIMIT_MAX_MESSAGES,
    windowMs: env.GROUP_RATE_LIMIT_WINDOW_MS,
    whitelistGroups: env.RATE_LIMIT_WHITELIST_GROUPS,
    whitelistUsers: env.RATE_LIMIT_WHITELIST_USERS,
    floodMaxPerSecond: env.FLOOD_MAX_MESSAGES_PER_SECOND,
    floodWindowMs: env.FLOOD_WINDOW_MS,
  },

  /** Economy limits */
  economy: {
    minBet: env.MIN_BET_AMOUNT,
    maxBet: env.MAX_BET_AMOUNT,
    vipMaxBet: env.VIP_MAX_BET_AMOUNT,
    minTransfer: env.MIN_TRANSFER_AMOUNT,
    maxTransfer: env.MAX_TRANSFER_AMOUNT,
  },
};
