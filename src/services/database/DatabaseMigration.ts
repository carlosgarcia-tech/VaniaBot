/**
 * database/DatabaseMigration.ts
 *
 * Versioned migrations for the JSON document store, which has no schema of its
 * own. The version is kept in a `_meta` key inside the document.
 *
 * Separate from repositories/Database.ts, which migrates the relational SQLite
 * schema via `_migrations`.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { logger } from '@/utils/logger.js';

/**
 * One schema step.
 * `up` mutates the document in place and must be idempotent enough to survive a
 * partially-applied run.
 */
export interface Migration {
  version: number;
  name: string;
  up: (data: Record<string, Record<string, unknown>>) => Promise<void>;
}

export class DatabaseMigration {
  private migrations: Migration[] = [];
  private currentVersion = 0;

  constructor() {
    this.registerMigrations();
  }

  /** Declares the migration list, sorted so they always apply in order. */
  private registerMigrations(): void {
    this.migrations = [
      {
        version: 1,
        name: 'add_schema_version',
        up: async data => {
          if (!data._meta) {
            data._meta = { version: 1 };
          }
        },
      },
    ];
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /** The declared migrations, in ascending version order. */
  getMigrations(): Migration[] {
    return this.migrations;
  }

  /** Schema version as of the last migrate() run. */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /** Overrides the tracked version without running migrations. */
  setCurrentVersion(version: number): void {
    this.currentVersion = version;
  }

  /**
   * Applies every migration newer than the document's recorded version.
   *
   * The version marker is advanced after each step, so a failure part-way leaves
   * the document at the last completed migration rather than replaying from the
   * start.
   *
   * @returns The resulting schema version.
   */
  async migrate(data: Record<string, Record<string, unknown>>): Promise<number> {
    const meta = data._meta as { version: number } | undefined;
    const fromVersion = meta?.version ?? 0;
    this.currentVersion = fromVersion;

    let migrationsRun = 0;
    for (const migration of this.migrations) {
      if (migration.version > fromVersion) {
        logger.info(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up(data);
        data._meta = { version: migration.version };
        this.currentVersion = migration.version;
        migrationsRun++;
      }
    }

    if (migrationsRun > 0) {
      logger.info(`Completed ${migrationsRun} migrations. New version: ${this.currentVersion}`);
    }

    return this.currentVersion;
  }
}

export const databaseMigration = new DatabaseMigration();
