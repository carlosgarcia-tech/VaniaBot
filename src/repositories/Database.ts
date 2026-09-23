/**
 * Database.ts
 *
 * SQLite Database wrapper for VaniaBot multi-bot architecture.
 * Provides connection management, migrations, and query helpers.
 *
 * NO Redis dependency - SQLite as single source of truth.
 * Uses sql.js (WebAssembly) for cross-platform compatibility (Termux/Docker/Linux).
 *
 * @author Carlos G
 * @created 2026-04-07
 */

import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import { logger, logError } from '@/utils/logger.js';

const DB_DIR = './storage/database';
const DB_PATH: string = join(DB_DIR, 'vania.db');

export interface DatabaseConfig {
  path?: string;
  mustExist?: boolean;
}

export interface Migration {
  version: number;
  name: string;
  up: string;
  /** Optional safe runner used when the SQL cannot be made idempotent. */
  custom?: (db: SqlJsDatabase) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_subbots_table',
    up: `
      CREATE TABLE IF NOT EXISTS subbots (
        id TEXT PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'subbot',
        status TEXT NOT NULL DEFAULT 'pending',
        enabled INTEGER NOT NULL DEFAULT 1,
        owner_jid TEXT,
        owner_name TEXT,
        session_path TEXT,
        prefix TEXT DEFAULT '.',
        slot_number INTEGER,
        bio TEXT,
        photo_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        autostart INTEGER DEFAULT 1,
        safe_mode INTEGER DEFAULT 0,
        safe_mode_reason TEXT,
        feature_flags TEXT,
        safe_mode_backup_flags TEXT
      );
    `,
  },
  {
    version: 2,
    name: 'create_subbot_slots',
    up: `
      CREATE TABLE IF NOT EXISTS subbot_slots (
        slot_number INTEGER PRIMARY KEY,
        bot_id TEXT,
        owner_jid TEXT,
        owner_name TEXT,
        phone_number TEXT,
        name TEXT,
        status TEXT NOT NULL DEFAULT 'free',
        requester_number TEXT,
        requested_at TEXT,
        released_at TEXT,
        connected_at TEXT,
        bio TEXT,
        photo_url TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_slots_status ON subbot_slots(status);
      CREATE INDEX IF NOT EXISTS idx_slots_bot ON subbot_slots(bot_id);
    `,
  },
  {
    version: 3,
    name: 'create_subbot_settings',
    up: `
      CREATE TABLE IF NOT EXISTS subbot_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO subbot_settings (key, value) VALUES ('maxSlots', '50');
      INSERT OR IGNORE INTO subbot_settings (key, value) VALUES ('publicRequests', 'true');
    `,
  },
  {
    version: 4,
    name: 'create_cooldowns',
    up: `
      CREATE TABLE IF NOT EXISTS cooldowns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_jid TEXT NOT NULL,
        command TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cooldowns_user ON cooldowns(user_jid, command);
      CREATE INDEX IF NOT EXISTS idx_cooldowns_expires ON cooldowns(expires_at);
    `,
  },
  {
    version: 5,
    name: 'create_locks',
    up: `
      CREATE TABLE IF NOT EXISTS locks (
        key TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 6,
    name: 'create_jobs',
    up: `
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_at TEXT NOT NULL,
        available_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        result TEXT,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, available_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
    `,
  },
  {
    version: 7,
    name: 'create_anticall_config',
    up: `
      CREATE TABLE IF NOT EXISTS anticall_config (
        id INTEGER PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        block_video INTEGER DEFAULT 1,
        block_unknown INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO anticall_config (id, enabled, block_video, block_unknown, updated_at) 
      VALUES (1, 1, 1, 0, datetime('now'));
    `,
  },
  {
    version: 8,
    name: 'create_anticall_blocked',
    up: `
      CREATE TABLE IF NOT EXISTS anticall_blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jid TEXT UNIQUE NOT NULL,
        blocked_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anticall_jid ON anticall_blocked_users(jid);
    `,
  },
  {
    version: 9,
    name: 'create_bot_runtime_state',
    up: `
      CREATE TABLE IF NOT EXISTS bot_runtime_state (
        bot_id TEXT PRIMARY KEY,
        is_connected INTEGER DEFAULT 0,
        last_heartbeat TEXT,
        last_message_processed_at TEXT,
        last_connection_event_at TEXT,
        connection_state TEXT,
        reconnect_attempts INTEGER DEFAULT 0,
        restart_count INTEGER DEFAULT 0,
        last_disconnect_reason TEXT,
        last_error TEXT,
        memory_usage_mb INTEGER,
        connection_latency_ms INTEGER,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_runtime_connected ON bot_runtime_state(is_connected);
      CREATE INDEX IF NOT EXISTS idx_runtime_heartbeat ON bot_runtime_state(last_heartbeat);
    `,
  },
  {
    version: 10,
    name: 'create_health_events',
    up: `
      CREATE TABLE IF NOT EXISTS health_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_health_bot ON health_events(bot_id, created_at);
    `,
  },
  {
    version: 11,
    name: 'create_orchestrator_state',
    up: `
      CREATE TABLE IF NOT EXISTS orchestrator_state (
        id INTEGER PRIMARY KEY,
        is_running INTEGER DEFAULT 0,
        last_health_check TEXT,
        active_bots INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO orchestrator_state (id, is_running, active_bots, updated_at) 
      VALUES (1, 0, 0, datetime('now'));
    `,
  },
  {
    version: 12,
    name: 'add_job_priority_columns',
    up: `
      ALTER TABLE jobs ADD COLUMN priority INTEGER DEFAULT 5;
      CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority, available_at);
    `,
  },
  {
    version: 13,
    name: 'add_startup_timestamp',
    up: `
      ALTER TABLE bot_runtime_state ADD COLUMN last_startup_at TEXT;
    `,
  },
  {
    version: 14,
    name: 'add_processed_messages_table',
    up: `
      CREATE TABLE IF NOT EXISTS processed_messages (
        message_id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        processed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_processed_messages_bot ON processed_messages(bot_id);
      CREATE INDEX IF NOT EXISTS idx_processed_messages_time ON processed_messages(processed_at);
    `,
  },
  {
    version: 15,
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        jid TEXT PRIMARY KEY,
        name TEXT,
        isOwner INTEGER DEFAULT 0,
        isAdmin INTEGER DEFAULT 0,
        isBanned INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        money INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        lastDaily INTEGER,
        lastWeekly INTEGER,
        lastMonthly INTEGER,
        weeklyStreak INTEGER DEFAULT 0,
        totalCommands INTEGER DEFAULT 0,
        warnings INTEGER DEFAULT 0,
        inventory TEXT DEFAULT '[]',
        achievements TEXT DEFAULT '[]',
        createdAt INTEGER,
        updatedAt INTEGER,
        currentClass TEXT,
        stats TEXT DEFAULT '{"hp":100,"maxHp":100,"energy":100,"maxEnergy":100,"stamina":100,"maxStamina":100,"atk":10,"def":5,"str":10,"int":10,"agi":10,"vit":10,"luck":10,"critChance":5,"dodgeChance":5}',
        pets TEXT DEFAULT '[]',
        activeQuests TEXT DEFAULT '[]',
        completedQuests TEXT DEFAULT '[]',
        activeBuffs TEXT DEFAULT '[]',
        premium INTEGER DEFAULT 0,
        premium_expires_at INTEGER,
        daily_streak INTEGER DEFAULT 0,
        last_daily TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
      CREATE INDEX IF NOT EXISTS idx_users_banned ON users(isBanned);
    `,
  },
  {
    version: 16,
    name: 'create_groups_table',
    up: `
      CREATE TABLE IF NOT EXISTS groups (
        jid TEXT PRIMARY KEY,
        name TEXT DEFAULT 'Group',
        isActive INTEGER DEFAULT 1,
        onlyAdmin INTEGER DEFAULT 0,
        welcome TEXT DEFAULT '{"enabled":false,"message":""}',
        goodbye TEXT DEFAULT '{"enabled":false,"message":""}',
        antiSpam TEXT DEFAULT '{"enabled":true,"maxMessages":10,"timeWindow":60}',
        antiLink TEXT DEFAULT '{"enabled":false,"allowedDomains":[]}',
        antiWords TEXT DEFAULT '{"enabled":false,"words":[]}',
        levels TEXT DEFAULT '{"enabled":true,"announceOnLevelUp":true}',
        economy TEXT DEFAULT '{"enabled":true}',
        audios INTEGER DEFAULT 0,
        nsfw INTEGER DEFAULT 0,
        prime TEXT DEFAULT '{"enabled":false}',
        license TEXT,
        autoMod TEXT DEFAULT '{"enabled":false}',
        stats TEXT DEFAULT '{"totalMessages":0,"totalCommands":0}',
        createdAt INTEGER,
        updatedAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(isActive);
    `,
  },
  {
    version: 17,
    name: 'create_vania_toggle_table',
    up: `
      CREATE TABLE IF NOT EXISTS vania_toggle (
        key TEXT PRIMARY KEY,
        chatJid TEXT NOT NULL,
        botId TEXT NOT NULL,
        enabled INTEGER DEFAULT 0,
        enabledBy TEXT,
        enabledAt INTEGER,
        disabledBy TEXT,
        disabledAt INTEGER,
        createdAt INTEGER,
        updatedAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_vania_toggle_chat ON vania_toggle(chatJid);
      CREATE INDEX IF NOT EXISTS idx_vania_toggle_bot ON vania_toggle(botId);
    `,
  },
  {
    version: 18,
    name: 'create_reports_table',
    up: `
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        type TEXT,
        user_jid TEXT,
        group_jid TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER,
        resolved_at INTEGER,
        resolved_by TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_jid);
    `,
  },
  {
    version: 19,
    name: 'create_persistence_tables',
    up: `
      CREATE TABLE IF NOT EXISTS reminders (
        key TEXT PRIMARY KEY,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS polls (
        key TEXT PRIMARY KEY,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS listas (
        key TEXT PRIMARY KEY,
        data TEXT
      );
    `,
  },
  {
    version: 21,
    name: 'fix_mutes_table',
    up: `
      DROP TABLE IF EXISTS mutes;
      CREATE TABLE IF NOT EXISTS mutes (
        id TEXT PRIMARY KEY,
        jid TEXT,
        userId TEXT,
        userName TEXT,
        reason TEXT,
        mutedBy TEXT,
        timestamp INTEGER,
        duration INTEGER,
        expiresAt INTEGER,
        groupId TEXT,
        updatedAt INTEGER,
        createdAt INTEGER,
        created_at INTEGER
      );

      -- Tabla bans
      CREATE TABLE IF NOT EXISTS bans (
        id TEXT PRIMARY KEY,
        jid TEXT,
        user_name TEXT,
        banned_by TEXT,
        reason TEXT,
        timestamp INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );

      -- Tabla moderation_logs
      DROP TABLE IF EXISTS moderation_logs;
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        userName TEXT,
        action TEXT,
        reason TEXT,
        moderator TEXT,
        timestamp INTEGER,
        duration INTEGER,
        expiresAt INTEGER,
        groupId TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      );

      -- Tabla ai_sessions
      CREATE TABLE IF NOT EXISTS ai_sessions (
        id TEXT PRIMARY KEY,
        jid TEXT,
        data TEXT,
        updated_at INTEGER
      );
    `,
  },
  {
    version: 22,
    name: 'fix_persistence_tables_columns',
    up: `
      ALTER TABLE reminders ADD COLUMN id TEXT;
      ALTER TABLE reminders ADD COLUMN createdAt INTEGER;
      ALTER TABLE reminders ADD COLUMN updatedAt INTEGER;
      
      ALTER TABLE polls ADD COLUMN id TEXT;
      ALTER TABLE polls ADD COLUMN createdAt INTEGER;
      ALTER TABLE polls ADD COLUMN updatedAt INTEGER;
      
      ALTER TABLE listas ADD COLUMN id TEXT;
      ALTER TABLE listas ADD COLUMN createdAt INTEGER;
      ALTER TABLE listas ADD COLUMN updatedAt INTEGER;
    `,
  },
  {
    version: 23,
    name: 'add_quiz_stats_column',
    up: '',
    custom: (db: SqlJsDatabase): void => {
      // ADD COLUMN is not idempotent in SQLite: check before altering.
      const cols = db.exec('PRAGMA table_info(users)');
      const existing: string[] = cols.length > 0 ? cols[0].values.map(row => String(row[1])) : [];
      if (existing.length > 0 && !existing.includes('quizStats')) {
        db.run('ALTER TABLE users ADD COLUMN quizStats TEXT');
      }
    },
  },
  {
    version: 24,
    name: 'add_bot_runtime_state_missing_columns',
    up: '',
    custom: (db: SqlJsDatabase): void => {
      // Columns used by RuntimeStateRepository (Watchdog/Recovery/Quarantine)
      // that were never created by migration v9.
      const cols = db.exec('PRAGMA table_info(bot_runtime_state)');
      const existing: string[] = cols.length > 0 ? cols[0].values.map(row => String(row[1])) : [];
      if (existing.length === 0) return;
      const additions: Array<[string, string]> = [
        ['error_count_total', 'INTEGER DEFAULT 0'],
        ['messages_total', 'INTEGER DEFAULT 0'],
        ['quarantined_until', 'TEXT'],
        ['quarantine_count', 'INTEGER DEFAULT 0'],
      ];
      for (const [column, definition] of additions) {
        if (!existing.includes(column)) {
          db.run(`ALTER TABLE bot_runtime_state ADD COLUMN ${column} ${definition}`);
        }
      }
    },
  },
];

export interface QueryResult {
  changes: number;
  lastInsertRowid: number;
}

export interface QueryOptions {
  params?: unknown[];
}

class DatabaseManager {
  private static _instance: DatabaseManager;
  private db: SqlJsDatabase | null = null;
  private config: DatabaseConfig;
  private _initialized = false;
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  private constructor(config: DatabaseConfig = {}) {
    this.config = {
      path: DB_PATH,
      mustExist: false,
      ...config,
    };
  }

  static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (!DatabaseManager._instance) {
      DatabaseManager._instance = new DatabaseManager(config);
    }
    return DatabaseManager._instance;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      const SQL = await initSqlJs();

      if (!existsSync(DB_DIR)) {
        mkdirSync(DB_DIR, { recursive: true });
      }

      const dbPath = this.config.path ?? DB_PATH;
      if (existsSync(dbPath)) {
        const buffer = readFileSync(dbPath);
        this.db = new SQL.Database(buffer);
        logger.debug('📂 Database loaded from disk');
      } else {
        this.db = new SQL.Database();
        logger.debug('🆕 New database created');
      }

      await this.runMigrations();
      this.startAutoSave();
      this._initialized = true;
      logger.debug('✅ Database initialized');
    } catch (error) {
      logError('[Database] Initialization failed', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS _migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      const result = this.db.exec('SELECT version FROM _migrations ORDER BY version');
      const appliedVersions =
        result.length > 0
          ? result[0].values.map((v: (number | string | null | Uint8Array)[]) => v[0] as number)
          : [];

      for (const migration of MIGRATIONS) {
        if (!appliedVersions.includes(migration.version)) {
          logger.debug(`🔄 Running migration v${migration.version}: ${migration.name}`);
          if (migration.custom) {
            migration.custom(this.db);
          } else {
            this.db.run(migration.up);
          }
          this.db.run('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)', [
            migration.version,
            migration.name,
            new Date().toISOString(),
          ]);
          this.markDirty();
          logger.debug(`✅ Migration v${migration.version} applied successfully`);
        }
      }
    } catch (error) {
      logError('[Database] Migration failed', error);
      throw error;
    }
  }

  private startAutoSave(): void {
    this.saveInterval = setInterval(() => {
      if (this.dirty) {
        this.saveToFile();
      }
    }, 30000);
  }

  private markDirty(): void {
    this.dirty = true;
  }

  forceSave(): void {
    this.saveToFile();
  }

  private saveToFile(): void {
    if (!this.db) return;
    const dbPath = this.config.path ?? DB_PATH;
    const tmpPath = `${dbPath}.tmp`;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      // Atomic write: write to a temp file then rename. If the process dies
      // mid-write, the original DB file stays intact instead of being truncated.
      writeFileSync(tmpPath, buffer);
      try {
        rmSync(dbPath, { force: true });
      } catch {}
      renameSync(tmpPath, dbPath);
      this.dirty = false;
      logger.debug('💾 Database saved to disk');
    } catch (error) {
      logError('[Database] Save to file failed', error);
      // Clean up the orphaned temp file if rename did not happen.
      try {
        if (existsSync(tmpPath)) rmSync(tmpPath, { force: true });
      } catch {}
    }
  }

  query(sql: string, options: QueryOptions = {}): QueryResult {
    if (!this.db) throw new Error('Database not initialized');

    try {
      this.db.run(sql, options.params as (string | number | Uint8Array | null)[]);
      const lastIdResult = this.db.exec('SELECT last_insert_rowid()');
      const changesResult = this.db.exec('SELECT changes()');

      const lastInsertRowid = lastIdResult.length > 0 ? Number(lastIdResult[0].values[0][0]) : 0;
      const changes = changesResult.length > 0 ? Number(changesResult[0].values[0][0]) : 0;

      this.markDirty();
      return { changes, lastInsertRowid };
    } catch (error) {
      logError('[Database] Query failed', error);
      throw error;
    }
  }

  fetchOne<T>(sql: string, options: QueryOptions = {}): T | null {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.exec(sql, options.params as (string | number | Uint8Array | null)[]);
      if (result.length === 0 || result[0].values.length === 0) {
        return null;
      }

      const columns = result[0].columns;
      const values = result[0].values[0];
      const row: Record<string, unknown> = {};

      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }

      return row as T;
    } catch (error) {
      logError('[Database] fetchOne failed', error);
      return null;
    }
  }

  fetchAll<T>(sql: string, options: QueryOptions = {}): T[] {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.exec(sql, options.params as (string | number | Uint8Array | null)[]);
      if (result.length === 0) {
        return [];
      }

      const columns = result[0].columns;
      return result[0].values.map(values => {
        const row: Record<string, unknown> = {};
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = values[i];
        }
        return row as T;
      });
    } catch (error) {
      logError('[Database] fetchAll failed', error);
      return [];
    }
  }

  close(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    if (this.dirty) {
      this.saveToFile();
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this._initialized = false;
    logger.info('🔒 Database closed');
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  isSQLite(): boolean {
    return true;
  }

  getDb(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }
}

let _dbManager: DatabaseManager;

export async function initializeDatabase(config?: DatabaseConfig): Promise<void> {
  _dbManager = DatabaseManager.getInstance(config);
  await _dbManager.initialize();
}

export function getDatabase(): DatabaseManager {
  if (!_dbManager) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _dbManager;
}

export function getDbManager(): DatabaseManager | undefined {
  return _dbManager;
}

export { DatabaseManager };

export default DatabaseManager;

const _FIX_MIGRATION = `
  ALTER TABLE mutes ADD COLUMN userId TEXT;
  ALTER TABLE bans ADD COLUMN userId TEXT;
  ALTER TABLE bans ADD COLUMN user_id TEXT;
  ALTER TABLE bans ADD COLUMN group_id TEXT;
  ALTER TABLE moderation_logs ADD COLUMN userId TEXT;
  ALTER TABLE moderation_logs ADD COLUMN group_id TEXT;
`;

function _applyFixMigration(db: DatabaseManager): void {
  if (db.isSQLite()) {
    const sqlDb = db.getDb();
    try {
      sqlDb.exec(`
        ALTER TABLE mutes ADD COLUMN userId TEXT;
      `);
    } catch {}
    try {
      sqlDb.exec(`ALTER TABLE bans ADD COLUMN userId TEXT;`);
    } catch {}
    try {
      sqlDb.exec(`ALTER TABLE bans ADD COLUMN user_id TEXT;`);
    } catch {}
    try {
      sqlDb.exec(`ALTER TABLE bans ADD COLUMN group_id TEXT;`);
    } catch {}
    try {
      sqlDb.exec(`ALTER TABLE moderation_logs ADD COLUMN userId TEXT;`);
    } catch {}
    try {
      sqlDb.exec(`ALTER TABLE moderation_logs ADD COLUMN group_id TEXT;`);
    } catch {}
  }
}
