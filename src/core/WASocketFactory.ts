/**
 * WASocketFactory.ts
 *
 * Single source of truth for WhatsApp Web connection options shared by the
 * main bot (AuthManager) and subbots (SubBotInstance): forced WA version,
 * silent Baileys logger, browser identities and socket options.
 *
 * IMPORTANT (July 2026): fetchLatestBaileysVersion() queries an endpoint
 * that has been returning outdated versions (reported in issues #2376 and
 * #2485 of WhiskeySockets/Baileys). WhatsApp rejects these versions with
 * a 405 "Connection Failure" error.
 *
 * As a workaround, we manually hardcode the latest verified version instead
 * of relying on that remote fetch.
 *
 * Source for updating when it fails again: https://wppconnect.io/whatsapp-versions/
 *   (take the first number from the "stable" list)
 *
 * Last updated: July 28, 2026
 */

import makeWASocket, { makeCacheableSignalKeyStore, type SignalKeyStore } from 'baileys';
import pino from 'pino';

/** Latest verified WhatsApp Web multi-device version. */
export const FORCED_WA_VERSION: [number, number, number] = [2, 3000, 1043984129];

let _cachedVersion: [number, number, number] | null = null;

/** Pino logger that silences Baileys' internal output. */
export const SILENT_WA_LOGGER = pino({ level: 'silent' });

/** Browser identity advertised when pairing via QR code. */
export const WA_BROWSER_QR: [string, string, string] = ['VaniaBot', 'Chrome', '131.0.6778.0'];
/** Browser identity advertised when pairing via pairing code (needs a desktop-ish UA). */
export const WA_BROWSER_PAIRING: [string, string, string] = ['Ubuntu', 'Chrome', '131.0.6778.0'];

export interface ErrorWithStatus {
  output?: {
    statusCode?: number;
  };
  message?: string;
}

/**
 * Resolves the WA version to use: the forced version, cached after the first
 * call. Used instead of fetchLatestBaileysVersion(), which currently returns
 * stale data and causes 405 "Connection Failure" rejections.
 */
export function getWAVersion(): [number, number, number] {
  if (_cachedVersion) return _cachedVersion;
  _cachedVersion = FORCED_WA_VERSION;
  return _cachedVersion;
}

type WASocketConfig = Parameters<typeof makeWASocket>[0];
type WASocketAuth = NonNullable<WASocketConfig['auth']>;

export interface BuildWASocketOptionsArgs {
  /** Authentication state (creds + keys) from the auth-state provider in use. */
  auth: WASocketAuth;
  /** Per-caller socket options; they win over the shared defaults. */
  overrides?: Partial<WASocketConfig>;
}

/**
 * Builds the Baileys socket options shared by main bot and subbots.
 * Per-caller differences (browser identity, keep-alive, retry delay, ...)
 * are passed via `overrides` so each site keeps its exact behavior.
 */
export function buildWASocketOptions(args: BuildWASocketOptionsArgs): WASocketConfig {
  return {
    version: getWAVersion(),
    auth: args.auth,
    logger: SILENT_WA_LOGGER,
    printQRInTerminal: false,
    browser: WA_BROWSER_QR,
    defaultQueryTimeoutMs: 60_000,
    connectTimeoutMs: 120_000,
    keepAliveIntervalMs: 20_000,
    getMessage: async () => undefined,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    retryRequestDelayMs: 250,
    shouldIgnoreJid: (jid: string) => jid?.endsWith('@broadcast'),
    emitOwnEvents: false,
    ...args.overrides,
  };
}

/** Creates a cacheable signal key store using the shared silent logger. */
export function createCacheableKeyStore(keys: SignalKeyStore): SignalKeyStore {
  return makeCacheableSignalKeyStore(keys, SILENT_WA_LOGGER);
}

/** Thin wrapper so callers get the socket from the shared factory. */
export function createWASocket(options: WASocketConfig): ReturnType<typeof makeWASocket> {
  return makeWASocket(options);
}
