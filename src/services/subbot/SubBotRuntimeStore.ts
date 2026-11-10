/**
 * SubBotRuntimeStore.ts
 *
 * Persistence for per-subbot runtime state (message dedup, contact name
 * cache, profile signature, pairing timestamp).
 *
 * Extracted from SubBotManager so the load path has real validation:
 * the previous loader trusted `data.id` blindly and accepted malformed
 * Map entries (NaN/missing timestamps, contact entries without name),
 * which a hand-edited or partially-written file could poison with.
 *
 * Contract:
 * - load(): null for missing files, invalid JSON, expired TTL, or an id that
 *   does not match the requested bot (avoids mixing state between bots).
 * - Entries older than their TTL are pruned on load AND on save, so a
 *   state never grows unbounded from files that skip writes.
 * - save() is atomic: temp file in the same dir + rename.
 * - Every failure is silent-but-logged: runtime state is best-effort, and
 *   must never break a subbot's startup.
 *
 * @author **Carlos G**
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import type { BotRuntimeState, ContactCacheEntry } from '@/types/subbot.js';
import { SUBBOT_CONFIG } from '@/config/subbot.js';
import { logger } from '@/utils/logger.js';

/** Shape of the on-disk JSON (Maps serialized as entry arrays). */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strict number: finite and non-negative. */
function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Validates and normalizes a deserialized message-dedup entry array.
 * Drops non-pairs, non-numeric/NaN timestamps and expired entries.
 */
function sanitizeMessageIds(raw: unknown, now: number): [string, number][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, number][] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [key, ts] = entry as [unknown, unknown];
    if (typeof key !== 'string' || key.length === 0) continue;
    const savedAt = nonNegativeNumber(ts);
    if (savedAt === undefined) continue;
    // TTL on load: stale entries must not revive a poisoned dedup.
    if (now - savedAt > SUBBOT_CONFIG.MESSAGE_DEDUP_TTL_MS) continue;
    out.push([key, savedAt]);
  }
  return out;
}

/**
 * Validates and normalizes a deserialized contact-cache entry array.
 * Drops malformed pairs and entries older than the cache TTL.
 */
function sanitizeContactCache(raw: unknown, now: number): [string, ContactCacheEntry][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, ContactCacheEntry][] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [key, value] = entry as [unknown, unknown];
    if (typeof key !== 'string' || key.length === 0) continue;
    if (!isRecord(value)) continue;
    const name = value.name;
    const cachedAt = nonNegativeNumber(value.cachedAt);
    if (typeof name !== 'string' || cachedAt === undefined) continue;
    if (now - cachedAt > SUBBOT_CONFIG.CONTACT_CACHE_TTL_MS) continue;
    out.push([key, { name, cachedAt }]);
  }
  return out;
}

function buildState(botId: string, raw: Record<string, unknown>, now: number): BotRuntimeState {
  return {
    id: botId,
    recentMessageIds: new Map(sanitizeMessageIds(raw.recentMessageIds, now)),
    contactNameCache: new Map(sanitizeContactCache(raw.contactNameCache, now)),
    lastProfileAppliedAt: nonNegativeNumber(raw.lastProfileAppliedAt) ?? 0,
    lastProfileSignature:
      typeof raw.lastProfileSignature === 'string' ? raw.lastProfileSignature : '',
    pairingPendingAt: nonNegativeNumber(raw.pairingPendingAt),
  };
}

export class SubBotRuntimeStore {
  private readonly dirOverride?: string;

  /**
   * @param dir overrides the runtime dir. By default it reads
   *   SUBBOT_CONFIG.RUNTIME_STATE_DIR on every access, so config changes
   *   (or tests that redirect the dir) apply without recreating the store.
   */
  constructor(dir?: string) {
    this.dirOverride = dir;
  }

  private get dir(): string {
    return this.dirOverride ?? SUBBOT_CONFIG.RUNTIME_STATE_DIR;
  }

  private fileFor(botId: string): string {
    // The id is generated internally as randomBytes(8).hex, but the path
    // must never be able to escape the runtime dir.
    if (!/^[A-Za-z0-9_-]+$/.test(botId)) {
      throw new Error(`Invalid subbot id for runtime state: ${botId}`);
    }
    return `${this.dir}/${botId}.json`;
  }

  ensureDir(): void {
    try {
      if (!existsSync(this.dir)) {
        mkdirSync(this.dir, { recursive: true });
      }
    } catch (error) {
      logger.warn(`[SubBotRuntimeStore] Could not create dir ${this.dir}:`, error);
    }
  }

  /**
   * Loads and validates the runtime state for a bot. Returns null when the
   * file is missing, unreadable, expired (TTL), has a mismatched id or is
   * not a JSON object: the caller creates a fresh state in that case.
   */
  load(botId: string): BotRuntimeState | null {
    let file: string;
    try {
      file = this.fileFor(botId);
    } catch (error) {
      logger.warn(`[SubBotRuntimeStore]`, error);
      return null;
    }
    if (!existsSync(file)) return null;

    try {
      const data: unknown = JSON.parse(readFileSync(file, 'utf-8'));
      if (!isRecord(data)) return null;

      const updatedAt = nonNegativeNumber(data.updatedAt) ?? 0;
      if (Date.now() - updatedAt > SUBBOT_CONFIG.BOT_RUNTIME_STATE_TTL_MS) {
        return null;
      }

      // The file's id must match the requested bot: a file copied/renamed
      // between bots must not contaminate another runtime.
      if (data.id !== botId) return null;

      return buildState(botId, data, Date.now());
    } catch (error) {
      logger.warn(`[SubBotRuntimeStore] Corrupt runtime state at ${file}:`, error);
      return null;
    }
  }

  /**
   * Atomically persists the state, pruning expired entries right before
   * the write so the file size stays proportional to live data.
   */
  save(state: BotRuntimeState): void {
    let file: string;
    try {
      file = this.fileFor(state.id);
    } catch (error) {
      logger.warn(`[SubBotRuntimeStore]`, error);
      return;
    }

    const now = Date.now();
    const prunedMessages = sanitizeMessageIds(Array.from(state.recentMessageIds.entries()), now);
    const prunedContacts = sanitizeContactCache(Array.from(state.contactNameCache.entries()), now);

    const data = {
      id: state.id,
      recentMessageIds: prunedMessages,
      contactNameCache: prunedContacts,
      lastProfileAppliedAt: state.lastProfileAppliedAt,
      lastProfileSignature: state.lastProfileSignature,
      pairingPendingAt: state.pairingPendingAt,
      updatedAt: now,
    };

    try {
      this.ensureDir();
      const tmpFile = `${file}.tmp`;
      writeFileSync(tmpFile, JSON.stringify(data));
      renameSync(tmpFile, file);
    } catch (error) {
      logger.debug(`[SubBotRuntimeStore] Runtime state write failed: ${error}`);
    }
  }

  /** Deletes the persisted state of a bot (best-effort). */
  delete(botId: string): void {
    try {
      rmSync(this.fileFor(botId), { force: true });
    } catch (error) {
      logger.warn(`[SubBotRuntimeStore]`, error);
    }
  }
}
