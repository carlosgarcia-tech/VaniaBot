/**
 * database/BatchWriter.ts
 *
 * Write-behind batching for the JSON/SQLite backends.
 *
 * Frequent small writes (counters, timestamps, session state) are coalesced into
 * one flush instead of hitting storage per mutation.
 *
 * Durability is handled with a write-ahead log: every scheduled write is first
 * persisted to a WAL file, and only cleared once the real write succeeds. A
 * crash therefore loses at most the in-flight batch, and the constructor replays
 * whatever was pending. The WAL itself is written atomically (temp file +
 * rename) so it can never be observed half-written.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { dirname } from 'path';
import path from 'path';
import { logError, logger } from '@/utils/logger.js';

/** One queued mutation, keyed by `${collection}:${key}` so repeats coalesce. */
interface PendingWrite<T = unknown> {
  collection: string;
  key: string;
  value: T;
  timestamp: number;
}

/** On-disk WAL payload. */
interface WALEntry {
  id: string;
  writes: PendingWrite[];
  createdAt: number;
}

export class BatchWriter {
  /** Pending mutations; a Map so repeated writes to one key replace, not append. */
  private pendingWrites = new Map<string, PendingWrite>();
  private writeTimer: NodeJS.Timeout | null = null;
  /** Guards against re-entrant flushes. */
  private isWriting = false;
  private walPath: string;
  private currentWalId: string = '';
  /** Collections that must flush almost immediately (e.g. economy). */
  private criticalWrites = new Set<string>();

  private readonly BATCH_INTERVAL = 2000;
  private readonly MAX_BATCH_SIZE = 50;
  private readonly WAL_DIR = './data/wal';

  /**
   * @param writeCallback Performs the actual batched write.
   * @param dbPath Database file path; the WAL is placed in its directory.
   */
  constructor(
    private writeCallback: (writes: PendingWrite[]) => Promise<void>,
    dbPath?: string,
  ) {
    const dir = dbPath ? dirname(dbPath) : './data';
    this.walPath = path.join(dir, 'wal', 'pending_writes.json');
    this.initializeWAL();
  }

  /**
   * Recovers pending writes from a previous run.
   * Removes orphaned temp files left by a crash mid-write, and discards a
   * corrupt WAL rather than refusing to start.
   */
  private initializeWAL(): void {
    try {
      const walDir = dirname(this.walPath);
      if (!existsSync(walDir)) {
        mkdirSync(walDir, { recursive: true });
      }

      const tmpFiles = [this.walPath + '.tmp', this.walPath + '.tmp_write'];
      for (const tmpFile of tmpFiles) {
        if (existsSync(tmpFile)) {
          unlinkSync(tmpFile);
          logger.warn(`[WAL] Cleaned orphan: ${tmpFile}`);
        }
      }

      if (existsSync(this.walPath)) {
        try {
          const data = readFileSync(this.walPath, 'utf-8');
          const wal: WALEntry = JSON.parse(data);

          if (wal.writes && Array.isArray(wal.writes) && wal.writes.length > 0) {
            for (const write of wal.writes) {
              this.pendingWrites.set(`${write.collection}:${write.key}`, write);
            }
            this.currentWalId = wal.id;
            logger.info(`[WAL] Recovered ${wal.writes.length} pending writes`);
          }
        } catch {
          rmSync(this.walPath);
        }
      }
    } catch (error) {
      logError('[WAL] Failed to initialize', error);
    }
  }

  /** Atomically rewrites the WAL (temp file + rename). */
  private persistWAL(): void {
    try {
      const wal: WALEntry = {
        id: this.currentWalId || crypto.randomUUID(),
        writes: Array.from(this.pendingWrites.values()),
        createdAt: Date.now(),
      };

      const tmpPath = this.walPath + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(wal, null, 2), 'utf-8');
      renameSync(tmpPath, this.walPath);
      this.currentWalId = wal.id;
    } catch (error) {
      logError('[WAL] Failed to persist', error);
    }
  }

  /** Deletes the WAL after a successful flush. */
  private clearWAL(): void {
    try {
      if (existsSync(this.walPath)) {
        rmSync(this.walPath);
      }
      this.currentWalId = '';
    } catch (error) {
      logError('[WAL] Failed to clear', error);
    }
  }

  /**
   * Queues a write and arms the flush timer.
   *
   * The WAL is persisted on every schedule call, so a crash before the flush
   * still replays the mutation. Critical collections flush straight away; a full
   * batch does too.
   */
  schedule(collection: string, key: string, value: unknown): void {
    const writeKey = `${collection}:${key}`;
    const isCritical = this.criticalWrites.has(collection);

    this.pendingWrites.set(writeKey, {
      collection,
      key,
      value,
      timestamp: Date.now(),
    });

    this.persistWAL();

    if (isCritical || this.pendingWrites.size >= this.MAX_BATCH_SIZE) {
      void this.flushNow();
      return;
    }

    if (!this.writeTimer) {
      const delay = isCritical ? 500 : this.BATCH_INTERVAL;
      this.writeTimer = setTimeout(() => {
        void this.flushNow();
      }, delay);
    }
  }

  /** Marks a collection as critical: its writes bypass batching delays. */
  markCritical(collection: string): void {
    this.criticalWrites.add(collection);
  }

  /** Returns a collection to normal batched behaviour. */
  unmarkCritical(collection: string): void {
    this.criticalWrites.delete(collection);
  }

  /**
   * Flushes the pending batch.
   *
   * On failure the batch is put back and the WAL rewritten, so the data is
   * retried rather than lost. Concurrent calls are ignored by the `isWriting`
   * guard, and the caller is responsible for retrying if that happens.
   */
  async flushNow(): Promise<void> {
    if (this.isWriting || this.pendingWrites.size === 0) {
      return;
    }

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    this.isWriting = true;

    const writes = Array.from(this.pendingWrites.values());

    try {
      await this.writeCallback(writes);
      this.pendingWrites.clear();
      this.clearWAL();
    } catch (error) {
      logError('Batch write error', error);
      for (const w of writes) {
        this.pendingWrites.set(`${w.collection}:${w.key}`, w);
      }
      this.persistWAL();
    } finally {
      this.isWriting = false;
    }
  }

  /** Flushes unconditionally, awaiting the in-flight flush if one is running. */
  async forceFlushNow(): Promise<void> {
    if (this.pendingWrites.size === 0) {
      return;
    }
    await this.flushNow();
  }

  /** Number of queued mutations. */
  /** Number of queued mutations. */
  getPendingCount(): number {
    return this.pendingWrites.size;
  }

  /** Whether anything is queued. Used by the shutdown path. */
  /** Whether anything is queued. Used by the shutdown path. */
  hasPendingWrites(): boolean {
    return this.pendingWrites.size > 0;
  }

  /** Drops all queued writes and the WAL. Test helper only. */
  /** Drops all queued writes and the WAL. Test helper only. */
  resetForTesting(): void {
    this.pendingWrites.clear();
    this.clearWAL();
  }
}
