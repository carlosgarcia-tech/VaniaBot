const SESSION_BASE_PATH = process.env.SUBBOT_SESSIONS_PATH
  ? process.env.SUBBOT_SESSIONS_PATH
  : process.env.DOCKER_MODE === 'true'
    ? '/app/subbot-sessions'
    : './data/subbot-sessions';

/**
 * SubBot configuration constants.
 */
export const SUBBOT_CONFIG = {
  /** Maximum number of subbot slots */
  MAX_SLOTS: 50,
  /** Default number of slots */
  DEFAULT_SLOTS: 15,
  /** Pairing code cache TTL in milliseconds */
  PAIRING_CODE_CACHE_MS: 60000,
  /** Allow public slot requests */
  PUBLIC_REQUESTS: true,
  /** Delay between slot operations in milliseconds */
  SLOT_STAGGER_MS: 700,
  /** Maximum stagger delay in milliseconds */
  SLOT_STAGGER_MAX_MS: 8000,
  /** Base path for subbot session storage */
  SESSION_BASE_PATH,
  /** Directory for runtime state files */
  RUNTIME_STATE_DIR: './data/runtime/bot-states',
  /** Bot runtime state TTL in milliseconds */
  BOT_RUNTIME_STATE_TTL_MS: 120000,
  /** Runtime state write debounce in milliseconds */
  RUNTIME_STATE_WRITE_DEBOUNCE_MS: 5000,
  /** Message deduplication TTL in milliseconds */
  MESSAGE_DEDUP_TTL_MS: 60000,
  /** Maximum message deduplication entries */
  MESSAGE_DEDUP_MAX_ENTRIES: 4000,
  /** Contact cache TTL in milliseconds */
  CONTACT_CACHE_TTL_MS: 10 * 60 * 1000,
  /** Maximum contact cache entries */
  CONTACT_CACHE_MAX_ENTRIES: 3000,
  /** Profile apply delay in milliseconds */
  PROFILE_APPLY_DELAY_MS: 15000,
  /** Health check interval in milliseconds */
  HEALTH_CHECK_INTERVAL: 2 * 60 * 1000,
  /** Health check confirmation delay in milliseconds */
  HEALTH_CHECK_CONFIRM_MS: 60 * 1000,
  /** Bot connecting stale timeout in milliseconds */
  BOT_CONNECTING_STALE_MS: 5 * 60 * 1000,
  /** Bot pairing stale timeout in milliseconds */
  BOT_PAIRING_STALE_MS: 5 * 60 * 1000,
  /** Settings sync interval in milliseconds */
  SETTINGS_SYNC_INTERVAL_MS: 60 * 1000,
} as const;

/** SubBot command execution timeout in milliseconds (3 minutes) */
export const SUBBOT_COMMAND_TIMEOUT_MS = 3 * 60 * 1000;
/** SubBot download timeout in milliseconds (12 minutes) */
export const SUBBOT_DOWNLOAD_TIMEOUT_MS = 12 * 60 * 1000;