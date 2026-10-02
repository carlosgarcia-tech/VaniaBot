/**
 * MongoDatabase.ts
 *
 * VaniaBot services module exposing `MongoDatabase`.
 *
 * @author **Carlos G**
 */

import type { Db, Collection, Filter, Document } from 'mongodb';
import { MongoClient, ObjectId } from 'mongodb';
import { Database } from './Database.js';
import type { PaginatedResult } from './Database.js';
import { logger, logError } from '@/utils/logger.js';
import { withRetry } from '@/services/system/RetryService.js';

export class MongoDatabase extends Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private uri: string;
  private dbName: string;

  constructor(uri: string, dbName: string = 'vaniabot') {
    super();
    this.uri = uri;
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.uri);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.connected = true;
      logger.info(`🗄️  Conectado a MongoDB: ${this.dbName}`);
    } catch (error) {
      logError('MongoDatabase.connect', error);
      throw new Error('Error al conectar con MongoDB');
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      logger.info('🗄️  Desconectado de MongoDB');
    }
  }

  private getCollection(name: string): Collection {
    if (!this.db) {
      throw new Error('Base de datos no conectada');
    }
    return this.db.collection(name);
  }

  private createIdFilter(key: string): ObjectId | string {
    if (/^[0-9a-fA-F]{24}$/.test(key)) {
      return new ObjectId(key);
    }
    return key;
  }

  private createIdFilterDocument(key: string): Filter<Document> {
    const id = this.createIdFilter(key);
    return { _id: id } as Filter<Document>;
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    const result = await coll.findOne(filter);
    return result ? (result as T) : null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);

    const doc = {
      ...value,
      _id: key,
    };

    await coll.updateOne(filter, { $set: doc }, { upsert: true });
  }

  async delete(collection: string, key: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    const result = await coll.deleteOne(filter);
    return result.deletedCount > 0;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    const count = await coll.countDocuments(filter);
    return count > 0;
  }

  async find<T>(collection: string, filter: Filter<Document>): Promise<T[]> {
    const coll = this.getCollection(collection);
    const results = await coll.find(filter).toArray();
    return results as T[];
  }

  async findOne<T>(collection: string, filter: Filter<Document>): Promise<T | null> {
    const coll = this.getCollection(collection);
    const result = await coll.findOne(filter);
    return result ? (result as T) : null;
  }

  async update<T>(collection: string, key: string, updates: Partial<T>): Promise<void> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    await coll.updateOne(filter, { $set: updates });
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const coll = this.getCollection(collection);
    const results = await coll.find({}).toArray();
    return results as T[];
  }

  async keys(collection: string): Promise<string[]> {
    const coll = this.getCollection(collection);
    const results = await coll.find({}).project({ _id: 1 }).toArray();
    return results.map(doc => String(doc._id));
  }

  async getPaginated<T>(
    collection: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    } = {},
  ): Promise<PaginatedResult<T>> {
    const coll = this.getCollection(collection);
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const sortField = options.sortBy || '_id';
    const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const filter = options.filter ?? {};
    const mongoFilter = this.convertFilter(filter);

    const [items, total] = await Promise.all([
      coll.find(mongoFilter).sort(sort).skip(skip).limit(limit).toArray(),
      coll.countDocuments(mongoFilter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items as T[],
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async count(collection: string, filter?: Record<string, unknown>): Promise<number> {
    const coll = this.getCollection(collection);
    const mongoFilter = filter ? this.convertFilter(filter) : {};
    return await coll.countDocuments(mongoFilter);
  }

  private convertFilter(filter: Record<string, unknown>): Filter<Document> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (key === '_id') {
        result[key] = this.createIdFilter(String(value));
      } else {
        result[key] = value;
      }
    }
    return result as Filter<Document>;
  }

  async clear(collection: string): Promise<void> {
    const coll = this.getCollection(collection);
    await coll.deleteMany({});
  }

  async retryOperation<T>(operation: () => Promise<T>, _operationName: string): Promise<T> {
    return withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 1000,
      onRetry: (attempt, error) => {
        logger.warn(
          `MongoDB ${_operationName} retry ${attempt}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      },
    });
  }

  async flush(): Promise<void> {}
}
