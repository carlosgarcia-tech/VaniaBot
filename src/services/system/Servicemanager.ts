import type { Database } from '../database/Database.js';
import { JsonDatabase } from '../database/JsonDatabase.js';
import { MongoDatabase } from '../database/MongoDatabase.js';
import { SQLiteAdapter } from '../database/SQLiteAdapter.js';
import { UserService } from '../database/UserService.js';
import { GroupService } from '../database/GroupService.js';
import { LevelService } from '../database/LevelService.js';
import { ModerationService } from '../moderation/ModerationService.js';
import { ReportService } from './ReportService.js';
import { VaniaToggleService } from './VaniaToggleService.js';
import { NsfwToggleService } from './NsfwToggleService.js';
import { PrimeService } from './PrimeService.js';
import { licenseService } from './LicenseService.js';
import { config } from '@/config/index.js';
import { logger, logError } from '@/utils/logger.js';
import { cleanupService } from './CleanupService.js';
import { healthCheckService, AutoRestartService } from './HealthCheckService.js';
import { sessionBackupService } from './SessionBackupService.js';
import { persistenceService } from './PersistenceService.js';
import { antiDeleteService } from './AntiDeleteService.js';
import { ensureDatabaseInitialized } from '@/repositories/Database.js';

/**
 * Central service manager that initializes and coordinates all services.
 * Implements singleton pattern for global access.
 */
export class ServiceManager {
  private static instance: ServiceManager;

  public db!: Database;
  public userService!: UserService;
  public groupService!: GroupService;
  public levelService!: LevelService;
  public moderationService!: ModerationService;
  public reportService!: ReportService;
  public vaniaToggleService!: VaniaToggleService;
  public nsfwToggleService!: NsfwToggleService;
  public primeService!: PrimeService;
  public licenseService = licenseService;
  public sessionBackupService = sessionBackupService;
  public persistenceService = persistenceService;

  /**
   * HealthCheckService imports this module (it reads serviceManager.db), so
   * these are lazy getters instead of field initialisers: an eager
   * initialiser would evaluate AutoRestartService.getInstance() while that
   * module is still mid-import and crash with "Cannot read properties of
   * undefined".
   */
  public get healthCheckService(): typeof healthCheckService {
    return healthCheckService;
  }

  public get autoRestartService(): AutoRestartService {
    return AutoRestartService.getInstance();
  }

  private constructor() {}

  /**
   * Gets the singleton instance.
   *
   * @returns The ServiceManager instance.
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initializes all services.
   *
   * @returns A promise that resolves when initialization is complete.
   */
  async initialize(): Promise<void> {
    try {
      logger.debug('Initializing services...');

      await this.initializeDatabase();

      persistenceService.setDatabase(this.db);
      await persistenceService.initialize();

      this.userService = new UserService(this.db);
      this.groupService = new GroupService(this.db);
      this.levelService = new LevelService(this.db, this.userService);
      this.moderationService = new ModerationService(this.db);
      this.reportService = new ReportService(this.db);
      await this.reportService.initialize();
      this.vaniaToggleService = new VaniaToggleService();
      this.vaniaToggleService.setDatabase(this.db);
      this.nsfwToggleService = new NsfwToggleService();
      this.nsfwToggleService.setDatabase(this.db);
      this.primeService = PrimeService.getInstance();
      this.primeService.setGroupService(this.groupService);
      licenseService.setGroupService(this.groupService);

      cleanupService.start();

      this.autoRestartService.setOnRestartCallback(() => {
        logger.warn('Auto-restart triggered but disabled - bot continues running');
      });
      this.autoRestartService.start();

      await this.sessionBackupService.start();

      logger.debug('Services initialized successfully');
    } catch (error) {
      logError('ServiceManager.initialize', error);
      throw error;
    }
  }

  /**
   * Initializes the database based on configuration.
   *
   * @returns A promise that resolves when the database is connected.
   */
  private async initializeDatabase(): Promise<void> {
    const dbType = config.database.type;

    switch (dbType) {
      case 'json':
        logger.info('Using JSON database (legacy)');
        this.db = new JsonDatabase(config.database.path);
        break;

      case 'mongodb':
        if (!config.database.uri) {
          throw new Error('MongoDB URI not configured');
        }
        logger.debug('Using MongoDB database');
        this.db = new MongoDatabase(config.database.uri);
        break;

      case 'sqlite':
        logger.debug('Using SQLite database');
        // index.ts already bootstrapped the engine at startup; reuse it
        // (ensureDatabaseInitialized is a no-op when the engine is live).
        await ensureDatabaseInitialized();
        this.db = new SQLiteAdapter();
        break;

      default:
        logger.warn(`Unknown database type: ${dbType}, using SQLite by default`);
        await ensureDatabaseInitialized();
        this.db = new SQLiteAdapter();
    }

    await this.db.connect();
  }

  /**
   * Gracefully shuts down all services.
   *
   * @returns A promise that resolves when shutdown is complete.
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down services...');
      cleanupService.stop();
      this.sessionBackupService.stop();
      this.autoRestartService.stop();
      persistenceService.stop();
      antiDeleteService.stop();
      if (this.db) {
        await this.db.disconnect();
      }

      logger.info('Services shut down successfully');
    } catch (error) {
      logError('ServiceManager.shutdown', error);
    }
  }

  /**
   * Checks if the service manager is ready.
   *
   * @returns True if the database is connected.
   */
  isReady(): boolean {
    return this.db && this.db.isConnected();
  }
}

export const serviceManager = ServiceManager.getInstance();