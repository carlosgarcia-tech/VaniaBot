/**
 * DatabaseSwitcher.ts
 *
 * Sistema dual SQLite/Redis para VaniaBot.
 * - Docker: usa Redis + SQLite (para sesiones)
 * - Normal: usa SQLite solo
 *
 * @author **Carlos G**
 * @created 2026-04-11
 */

import { createClient, type RedisClientType } from 'redis';
import { existsSync } from 'fs';
import { logger } from '@/utils/logger.js';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface SwitcherConfig {
  useRedis: boolean;
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
  dbPath?: string;
}

const DEFAULT_CONFIG: SwitcherConfig = {
  useRedis: process.env.USE_REDIS === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  dbPath: process.env.DB_PATH || './storage/database/vania.db',
};

let redisClient: RedisClientType | null = null;
let useRedis = false;

export class DatabaseSwitcher {
  private static instance: DatabaseSwitcher;
  private config: SwitcherConfig;
  private initialized = false;

  private constructor(config: Partial<SwitcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<SwitcherConfig>): DatabaseSwitcher {
    if (!DatabaseSwitcher.instance) {
      DatabaseSwitcher.instance = new DatabaseSwitcher(config);
    }
    return DatabaseSwitcher.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const isDocker = process.env.DOCKER_MODE === 'true' || existsSync('/.dockerenv');

    if (isDocker && this.config.useRedis) {
      await this.initializeRedis();
    } else {
      useRedis = false;
      logger.debug('[DatabaseSwitcher] Modo SQLite local');
    }

    this.initialized = true;
  }

  private async initializeRedis(): Promise<void> {
    try {
      let url = this.config.redisUrl;

      if (!url && this.config.useRedis) {
        const possibleHosts = ['vania-redis', 'redis', 'localhost'];

        for (const host of possibleHosts) {
          try {
            const testUrl = `redis://${host}:6379`;
            logger.debug(`[DatabaseSwitcher] Probando Redis en ${testUrl}...`);

            const testClient = createClient({ url: testUrl });
            await testClient.connect();
            const ping = await testClient.ping();
            await testClient.quit();

            if (ping === 'PONG') {
              url = testUrl;
              logger.debug(`[DatabaseSwitcher] ✅ Redis encontrado en ${host}`);
              break;
            }
          } catch {
            logger.debug(
              `[DatabaseSwitcher] Redis no disponible en ${host}, intentando siguiente...`,
            );
          }
        }
      }

      if (!url) {
        url = 'redis://localhost:6379';
      }

      logger.debug(`[DatabaseSwitcher] Conectando a Redis: ${url}`);

      redisClient = createClient({
        url,
        socket: {
          reconnectStrategy: retries => {
            if (retries > 3) {
              logger.warn('[DatabaseSwitcher] Max reconnect attempts, falling back to SQLite');
              return new Error('Max retries');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      redisClient.on('error', err => {
        logger.error('[DatabaseSwitcher] Redis error:', err);
      });

      redisClient.on('connect', () => {
        logger.debug('[DatabaseSwitcher] ✅ Redis conectado');
      });

      await redisClient.connect();
      useRedis = true;

      logger.debug('[DatabaseSwitcher] ✅ Modo Redis activo');
    } catch (error) {
      logger.warn('[DatabaseSwitcher] Redis no disponible, usando SQLite:', error);
      useRedis = false;
    }
  }

  isUsingRedis(): boolean {
    return useRedis;
  }

  isRedisConnected(): boolean {
    return redisClient?.isOpen ?? false;
  }

  getRedisClient(): RedisClientType | null {
    return redisClient;
  }

  async close(): Promise<void> {
    if (redisClient?.isOpen) {
      await redisClient.quit();
      redisClient = null;
    }
    this.initialized = false;
  }
}

export const databaseSwitcher = DatabaseSwitcher.getInstance();

export default databaseSwitcher;
