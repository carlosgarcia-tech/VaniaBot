/**
 * JsonFileStore.ts
 *
 * Generic JSON file-backed store with atomic writes.
 *
 * Consolidates the `ensureDir/loadStore/saveStore` boilerplate previously
 * duplicated across services (Antilink, AntiArab, Resilience,
 * ChatSummary, FreeFire). Writes are atomic: data is serialized to a
 * temp file in the same directory and renamed over the target, so a
 * crash mid-write never corrupts the store.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from './logger.js';

/**
 * Configuration options for JsonFileStore.
 *
 * @typeParam T - The type of the store data.
 */
export interface JsonFileStoreOptions<T> {
  /** Absolute or cwd-relative path of the JSON file. */
  filePath: string;
  /** Store shape returned when the file does not exist or is corrupt. */
  defaults: () => T;
  /**
   * Optional validation invoked after parsing. Return a normalized store
   * (or the default) instead of throwing.
   */
  validate?: (data: unknown) => T;
}

/**
 * Generic JSON file store with atomic writes.
 *
 * @typeParam T - The type of the store data.
 */
export class JsonFileStore<T> {
  private readonly filePath: string;
  private readonly defaults: () => T;
  private readonly validate?: (data: unknown) => T;

  /**
   * Creates a new JsonFileStore.
   *
   * @param options - The store options.
   */
  constructor(options: JsonFileStoreOptions<T>) {
    this.filePath = options.filePath;
    this.defaults = options.defaults;
    this.validate = options.validate;
  }

  /**
   * Gets the file path.
   */
  get path(): string {
    return this.filePath;
  }

  /**
   * Ensures the parent directory exists.
   */
  ensureDir(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Loads the store from disk.
   * Returns defaults if file doesn't exist, is corrupt, or validation fails.
   *
   * @returns The loaded store data.
   */
  load(): T {
    this.ensureDir();
    try {
      if (!existsSync(this.filePath)) {
        return this.defaults();
      }
      const raw = readFileSync(this.filePath, 'utf-8');
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return this.defaults();
      }
      if (this.validate) {
        return this.validate(data);
      }
      return data as T;
    } catch (error) {
      logger.warn(`[JsonFileStore] Corrupt store at ${this.filePath}, resetting:`, error);
      return this.defaults();
    }
  }

  /**
   * Atomically persists the store: writes to `<file>.tmp` in the same
   * directory and renames over the target. Rename is atomic on POSIX and
   * Windows, so readers never observe a half-written file.
   *
   * @param store - The store data to save.
   */
  save(store: T): void {
    this.ensureDir();
    const tmpPath = join(dirname(this.filePath), `.${basename(this.filePath)}.tmp`);
    try {
      writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
      renameSync(tmpPath, this.filePath);
    } catch (error) {
      logger.error(`[JsonFileStore] Failed to save ${this.filePath}:`, error);
      try {
        rmSync(tmpPath, { force: true });
      } catch {
        // best effort
      }
      throw error;
    }
  }
}

/**
 * Extracts the basename from a file path (works on both POSIX and Windows).
 *
 * @param filePath - The file path.
 * @returns The basename.
 */
function basename(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  const winIdx = filePath.lastIndexOf('\\');
  return filePath.slice(Math.max(idx, winIdx) + 1);
}