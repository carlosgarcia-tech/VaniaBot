/**
 * env.ts
 *
 * Environment configuration for VaniaBot using Zod validation.
 * All configuration values can be set via .env file.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tolerant enum parser: trims, lowercases and falls back to the default value
 * instead of throwing a cryptic ZodError at import time (e.g. LOG_LEVEL=" info").
 */
function tolerantEnum<T extends readonly string[]>(values: T, fallback: T[number]) {
  return z
    .string()
    .optional()
    .transform(val => {
      const cleaned = val?.trim().toLowerCase();
      return (values as readonly string[]).includes(cleaned ?? '')
        ? (cleaned as T[number])
        : fallback;
    });
}

/**
 * Environment schema with validation and transformation.
 * All values have sensible defaults but can be overridden via .env
 */
const envSchema = z.object({
  /** Minimum bet amount for economy commands */
  MIN_BET_AMOUNT: z
    .string()
    .transform(val => parseInt(val) || 50)
    .default('50'),

  /** Maximum bet amount for economy commands */
  MAX_BET_AMOUNT: z
    .string()
    .transform(val => parseInt(val) || 100000)
    .default('100000'),

  /** VIP max bet amount */
  VIP_MAX_BET_AMOUNT: z
    .string()
    .transform(val => parseInt(val) || 500000)
    .default('500000'),

  /** Minimum transfer amount */
  MIN_TRANSFER_AMOUNT: z
    .string()
    .transform(val => parseInt(val) || 100)
    .default('100'),

  /** Maximum transfer amount */
  MAX_TRANSFER_AMOUNT: z
    .string()
    .transform(val => parseInt(val) || 50000)
    .default('50000'),

  /** Bot display name */
  BOT_NAME: z.string().default('VaniaBot'),

  /** Command prefix */
  PREFIX: z.string().default('.'),
  BOT_PREFIX: z.string().default('.'),

  /** Owner JIDs (phone numbers and LID IDs) - comma separated.
   *  Set via OWNERS in .env file */
  OWNERS: z
    .string()
    .default('5219514639799,208924405956643@lid')
    .transform(val => val.split(',').filter(Boolean)),

  /** Main owner JID - the creator of the bot (first in OWNERS list).
   *  Set via OWNER_JID in .env file */
  OWNER_JID: z.string().default('208924405956643@lid'),

  /** Additional owner JIDs for specific permissions */
  OWNER_JIDS: z
    .string()
    .optional()
    .default('208924405956643@lid')
    .transform(val => (val ? val.split(',').filter(Boolean) : [])),

  /** Session storage directory path */
  SESSION_PATH: z.string().default('./vaniasession'),

  /** Encryption key for SubBot sessions (AES-256-GCM).
   * Format: 32 chars salt + password. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex') + require('crypto').randomBytes(32).toString('hex'))" */
  SESSION_ENCRYPTION_KEY: z.string().optional(),

  /** Use pairing code instead of QR code for authentication */
  USE_PAIRING_CODE: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  /** Phone number for pairing code authentication (include country code) */
  PHONE_NUMBER: z.string().default(''),

  /** Database type: 'json', 'mongodb' or 'sqlite' */
  DB_TYPE: tolerantEnum(['json', 'mongodb', 'sqlite'] as const, 'sqlite'),

  /** MongoDB connection URI (required if DB_TYPE=mongodb) */
  DB_URI: z.string().optional(),

  /** Node environment: 'development' or 'production' */
  NODE_ENV: tolerantEnum(['development', 'production', 'test'] as const, 'development'),

  /** Maximum reconnection attempts on connection failure */
  MAX_RECONNECT_ATTEMPTS: z
    .string()
    .transform(val => parseInt(val) || 10)
    .default('10'),

  /** Enable automatic reconnection */
  AUTO_RECONNECT: z
    .string()
    .transform(val => val === 'true')
    .default('true'),

  /** Enable in-memory caching */
  CACHE_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('true'),

  /** Enable anti-spam middleware */
  ANTI_SPAM: z
    .string()
    .transform(val => val === 'true')
    .default('true'),

  /** Groq API key for AI features (get free at https://console.groq.com/keys) */
  GROQ_API_KEY: z.string().optional(),

  /** DeepAI API key for image processing (get at https://deepai.org) */
  DEEPAI_API_KEY: z.string().optional(),

  /** NewsData.io API key for news features (get at https://newsdata.io) */
  NEWSDATA_API_KEY: z.string().optional(),

  /** Pixabay API key for image search (get at https://pixabay.com/api/docs) */
  PIXABAY_API_KEY: z.string().optional(),

  /** Pexels API key for image search (get at https://pexels.com/api) */
  PEXELS_API_KEY: z.string().optional(),

  /** Gemini API key for AI fallback (get at https://makersuite.google.com/app/apikey) */
  GEMINI_API_KEY: z.string().optional(),

  /** Panel webhook token for API authentication */
  PANEL_WEBHOOK_TOKEN: z.string().optional(),

  /** Log level: error | warn | info | debug */
  LOG_LEVEL: tolerantEnum(['error', 'warn', 'info', 'debug'] as const, 'debug'),

  /** WebSocket connection timeout in milliseconds */
  CONNECT_TIMEOUT: z
    .string()
    .transform(val => parseInt(val) || 90000)
    .default('90000'),

  /** Keep-alive interval in milliseconds */
  KEEP_ALIVE_INTERVAL: z
    .string()
    .transform(val => parseInt(val) || 25000)
    .default('25000'),

  /** Maximum quick restarts before forced delay (vania.ts) */
  MAX_QUICK_RESTARTS: z
    .string()
    .transform(val => parseInt(val) || 5)
    .default('5'),

  /** Time window for quick restarts in milliseconds */
  RESTART_WINDOW_MS: z
    .string()
    .transform(val => parseInt(val) || 120000)
    .default('120000'),

  /** Maximum restart delay in milliseconds */
  MAX_RESTART_DELAY_MS: z
    .string()
    .transform(val => parseInt(val) || 30000)
    .default('30000'),

  /** Forced restart wait time after too many quick restarts */
  FORCE_RESTART_WAIT_MS: z
    .string()
    .transform(val => parseInt(val) || 60000)
    .default('60000'),

  /** Retry delay in milliseconds */
  RETRY_DELAY: z
    .string()
    .transform(val => parseInt(val) || 200)
    .default('200'),

  /** Maximum database cache size */
  DB_CACHE_MAX_SIZE: z
    .string()
    .transform(val => parseInt(val) || 10000)
    .default('10000'),

  /** Database save delay in milliseconds */
  DB_SAVE_DELAY: z
    .string()
    .transform(val => parseInt(val) || 2000)
    .default('2000'),

  /** Database force save interval in milliseconds */
  DB_FORCE_SAVE_INTERVAL: z
    .string()
    .transform(val => parseInt(val) || 30000)
    .default('30000'),

  /** Maximum commands per minute per user */
  MAX_COMMANDS_PER_MINUTE: z
    .string()
    .transform(val => parseInt(val) || 10)
    .default('10'),

  /** Maximum media file size in bytes (default: 50MB) */
  MAX_MEDIA_SIZE: z
    .string()
    .transform(val => parseInt(val) || 52428800)
    .default('52428800'),

  /** Automatically mark messages as read */
  AUTO_READ: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  /** Enable self-reply for bot messages */
  SELF_REPLY: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  /** Maximum messages per minute per group (global rate limit) */
  GROUP_RATE_LIMIT_MAX_MESSAGES: z
    .string()
    .transform(val => parseInt(val) || 30)
    .default('30'),

  /** Rate limit window in milliseconds (default: 1 minute) */
  GROUP_RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(val => parseInt(val) || 60000)
    .default('60000'),

  /** Whitelisted group JIDs (comma separated) */
  RATE_LIMIT_WHITELIST_GROUPS: z
    .string()
    .optional()
    .default('')
    .transform(val => (val ? val.split(',').filter(Boolean) : [])),

  /** Whitelisted user JIDs (comma separated) */
  RATE_LIMIT_WHITELIST_USERS: z
    .string()
    .optional()
    .default('')
    .transform(val => (val ? val.split(',').filter(Boolean) : [])),

  /** Maximum messages per second per user (flood protection) */
  FLOOD_MAX_MESSAGES_PER_SECOND: z
    .string()
    .transform(val => parseInt(val) || 3)
    .default('3'),

  /** Flood check window in milliseconds */
  FLOOD_WINDOW_MS: z
    .string()
    .transform(val => parseInt(val) || 1000)
    .default('1000'),

  /** Maximum AI conversation sessions */
  MAX_AI_SESSIONS: z
    .string()
    .transform(val => parseInt(val) || 1000)
    .default('1000'),

  /** Enable Redis for cache and persistence (use in Docker) */
  USE_REDIS: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  /** Redis connection URL */
  REDIS_URL: z.string().default('redis://localhost:6379'),

  /** Redis host (for Docker) */
  REDIS_HOST: z.string().default('localhost'),

  /** Redis port */
  REDIS_PORT: z.string().default('6379'),
});

/**
 * Parsed and validated environment configuration
 * @example
 * import { env } from '@/config/env.js';
 * console.log(env.BOT_NAME);
 */
export const env = envSchema.parse(process.env);
