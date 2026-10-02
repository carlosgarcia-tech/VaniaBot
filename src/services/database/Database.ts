/**
 * database/Database.ts
 *
 * Storage abstraction: a key/value collection interface that hides whether the
 * backing store is SQLite, MongoDB or a JSON file.
 *
 * Callers (services, repositories) depend only on this interface, so the
 * backend is swappable via DB_TYPE without touching business logic.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

/**
 * Storage contract shared by every backend.
 *
 * Note the shape is key/value per collection rather than relational: filters
 * are shallow equality matches, which is enough for the bot's access patterns
 * but means complex queries belong in SQL rather than here.
 */
export interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  get<T>(collection: string, key: string): Promise<T | null>;
  set<T>(collection: string, key: string, value: T): Promise<void>;
  delete(collection: string, key: string): Promise<boolean>;
  has(collection: string, key: string): Promise<boolean>;

  find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]>;
  findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null>;

  update<T>(collection: string, key: string, updates: Partial<T>): Promise<void>;

  getAll<T>(collection: string): Promise<T[]>;
  keys(collection: string): Promise<string[]>;

  /** Paginated query options. */
  getPaginated<T>(
    collection: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    },
  ): Promise<PaginatedResult<T>>;

  count(collection: string, filter?: Record<string, unknown>): Promise<number>;

  clear(collection: string): Promise<void>;
  /**
   * Commits buffered writes.
   * A no-op for backends that write through immediately; required for batched
   * ones so durability is explicit at shutdown.
   */
  flush(): Promise<void>;
}

/** One page of results plus the navigation flags callers need. */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Base class for concrete backends.
 * Only `isConnected` is shared; every storage operation is backend-specific.
 */
export abstract class Database implements IDatabase {
  protected connected = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract get<T>(collection: string, key: string): Promise<T | null>;
  abstract set<T>(collection: string, key: string, value: T): Promise<void>;
  abstract delete(collection: string, key: string): Promise<boolean>;
  abstract has(collection: string, key: string): Promise<boolean>;
  abstract find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]>;
  abstract findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null>;
  abstract update<T>(collection: string, key: string, updates: Partial<T>): Promise<void>;
  abstract getAll<T>(collection: string): Promise<T[]>;
  abstract keys(collection: string): Promise<string[]>;
  abstract getPaginated<T>(
    collection: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    },
  ): Promise<PaginatedResult<T>>;
  abstract count(collection: string, filter?: Record<string, unknown>): Promise<number>;
  abstract clear(collection: string): Promise<void>;
  abstract flush(): Promise<void>;

  /** Whether `connect()` has completed and the backend is usable. */
  isConnected(): boolean {
    return this.connected;
  }
}
