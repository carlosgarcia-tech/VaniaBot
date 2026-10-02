/**
 * repositories/index.ts
 *
 * Public surface of the data layer: re-exports every repository singleton and
 * exposes a thin `databaseManager` facade for callers that only need raw SQL.
 *
 * Importing `@/repositories` never touches the filesystem — the engine is
 * opened explicitly through `initializeDatabase` / `initAllRepositories`, which
 * keeps module imports side-effect free and makes test setup predictable.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { initializeDatabase, getDatabase, getDbManager, DatabaseManager } from './Database.js';
import { subBotRepository, SubBotRepository } from './SubBotRepository.js';
import { runtimeStateRepository, RuntimeStateRepository } from './RuntimeStateRepository.js';
import {
  processedMessagesRepository,
  ProcessedMessagesRepository,
} from './ProcessedMessagesRepository.js';

export {
  initializeDatabase,
  getDatabase,
  getDbManager,
  DatabaseManager,
  subBotRepository,
  SubBotRepository,
  runtimeStateRepository,
  RuntimeStateRepository,
  processedMessagesRepository,
  ProcessedMessagesRepository,
};

export type { SubBotRecord, CreateSubBotInput, UpdateSubBotInput } from './SubBotRepository.js';
export type {
  BotRuntimeStateRecord,
  CreateRuntimeStateInput,
  ConnectionState,
} from './RuntimeStateRepository.js';
export type { ProcessedMessageRecord } from './ProcessedMessagesRepository.js';

let _initialized = false;

/**
 * Opens the database and marks the repository layer ready.
 * Idempotent: repeat calls are no-ops once the engine is up.
 */
export async function initAllRepositories(): Promise<void> {
  if (_initialized) return;
  await initializeDatabase();
  _initialized = true;
}

/**
 * Convenience facade over the raw query API for code that has no dedicated
 * repository yet. Prefer a purpose-built repository where one exists, so schema
 * knowledge stays in the data layer instead of spreading across services.
 */
const databaseManager = {
  query: (sql: string, opts?: { params?: unknown[] }) => getDatabase().query(sql, opts),
  fetchOne: <T = unknown>(sql: string, opts?: { params?: unknown[] }) =>
    getDatabase().fetchOne<T>(sql, opts),
  fetchAll: <T = unknown>(sql: string, opts?: { params?: unknown[] }) =>
    getDatabase().fetchAll<T>(sql, opts),
  forceSave: () => getDatabase().forceSave(),
};

export { databaseManager };

export default {
  initializeDatabase,
  getDatabase,
  initAllRepositories,
  subBotRepository,
  runtimeStateRepository,
  processedMessagesRepository,
};
