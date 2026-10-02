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

export async function initAllRepositories(): Promise<void> {
  if (_initialized) return;
  await initializeDatabase();
  _initialized = true;
}

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
