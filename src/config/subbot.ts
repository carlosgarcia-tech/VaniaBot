/**
 * subbot.ts
 *
 * Tuning constants for the sub-bot subsystem (secondary WhatsApp sessions spawned
 * by the owner), plus the on-disk locations where their state is persisted.
 *
 * All values are compile-time constants (`as const`) rather than environment
 * variables: these are internal engine limits, not operator-tunable settings.
 * The only exception is the session base path, which differs between Docker and
 * local runs.
 *
 * @author **Carlos G**
 */

/**
 * Directory where sub-bot auth sessions are stored.
 *
 * Resolution order: explicit SUBBOT_SESSIONS_PATH override, then the container
 * path when running under Docker, then a repo-local path for development.
 */
const SESSION_BASE_PATH = process.env.SUBBOT_SESSIONS_PATH
  ? process.env.SUBBOT_SESSIONS_PATH
  : process.env.DOCKER_MODE === 'true'
    ? '/app/subbot-sessions'
    : './data/subbot-sessions';

export const SUBBOT_CONFIG = {
  /** Hard ceiling on how many sub-bots may exist at once. */
  MAX_SLOTS: 50,
  /** Slots provisioned per creation request. */
  DEFAULT_SLOTS: 15,
  /** How long a generated pairing code stays reusable. */
  PAIRING_CODE_CACHE_MS: 60000,
  /** Allow non-owners to request their own pairing code. */
  PUBLIC_REQUESTS: true,
  /** Base delay between sequential bot startups, to avoid a connection burst. */
  SLOT_STAGGER_MS: 700,
  /** Upper bound the stagger delay is capped at for large batches. */
  SLOT_STAGGER_MAX_MS: 8000,
  SESSION_BASE_PATH,
  /** Directory holding each running bot's in-memory snapshot. */
  RUNTIME_STATE_DIR: './data/runtime/bot-states',
  /** How long a runtime snapshot stays valid before being considered stale. */
  BOT_RUNTIME_STATE_TTL_MS: 120000,
  /** Coalescing window for runtime-state writes, to avoid write amplification. */
  RUNTIME_STATE_WRITE_DEBOUNCE_MS: 5000,
  /** Window for message-ID deduplication across reconnects. */
  MESSAGE_DEDUP_TTL_MS: 60000,
  /** Maximum retained message IDs in the dedup cache. */
  MESSAGE_DEDUP_MAX_ENTRIES: 4000,
  /** Contact metadata cache lifetime. */
  CONTACT_CACHE_TTL_MS: 10 * 60 * 1000,
  /** Maximum entries held in the contact cache. */
  CONTACT_CACHE_MAX_ENTRIES: 3000,
  /** Grace period after pairing before profile data is applied. */
  PROFILE_APPLY_DELAY_MS: 15000,
  /** Interval between sub-bot liveness probes. */
  HEALTH_CHECK_INTERVAL: 2 * 60 * 1000,
  /** A bot must be healthy this long before it is treated as recovered. */
  HEALTH_CHECK_CONFIRM_MS: 60 * 1000,
  /** A bot stuck in "connecting" for this long is presumed dead. */
  BOT_CONNECTING_STALE_MS: 5 * 60 * 1000,
  /** A bot stuck awaiting pairing for this long is presumed abandoned. */
  BOT_PAIRING_STALE_MS: 5 * 60 * 1000,
  /** How often settings are pushed from the main bot to sub-bots. */
  SETTINGS_SYNC_INTERVAL_MS: 60 * 1000,
} as const;

/** Upper bound for a command executed against a sub-bot session. */
export const SUBBOT_COMMAND_TIMEOUT_MS = 3 * 60 * 1000;
/** Upper bound for media downloads performed by a sub-bot (deliberately longer). */
export const SUBBOT_DOWNLOAD_TIMEOUT_MS = 12 * 60 * 1000;
