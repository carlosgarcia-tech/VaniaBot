/**
 * Servicemanager.ts
 *
 * Composition root for the service layer: owns every domain service instance
 * and wires their dependencies together at startup.
 *
 * Services are exposed as fields on a singleton so the rest of the codebase can
 * reach them without importing a dozen modules or managing lifetimes itself.
 *
 * Startup order matters and is enforced here: the database is connected first,
 * then services are constructed in dependency order (LevelService needs
 * UserService, PrimeService needs GroupService), then background timers start.
 * Shutdown reverses it.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

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

export class ServiceManager {
  private static instance: ServiceManager;

  /** Storage backend selected by DB_TYPE; see initializeDatabase(). */
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

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Boots every service in dependency order, then starts background timers.
   * @throws Propagates database/initialisation failures so startup can abort.
   */
  async initialize(): Promise<void> {
    try {
      logger.debug('🔧 Inicializando servicios...');

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
        logger.warn('⚠️ Auto-restart triggered but disabled - bot continues running');
      });
      this.autoRestartService.start();

      await this.sessionBackupService.start();

      logger.debug('Servicios inicializados correctamente');
    } catch (error) {
      logError('ServiceManager.initialize', error);
      throw error;
    }
  }

  /**
   * Instantiates the storage backend selected by DB_TYPE.
   *
   * SQLite is the default and reuses the engine index.ts already opened, rather
   * than bootstrapping a second one. An unrecognised DB_TYPE also falls back to
   * SQLite rather than failing, so a typo in the environment does not prevent the
   * bot from starting.
   */
  private async initializeDatabase(): Promise<void> {
    const dbType = config.database.type;

    switch (dbType) {
      case 'json':
        logger.info('Usando base de datos JSON (legacy)');
        this.db = new JsonDatabase(config.database.path);
        break;

      case 'mongodb':
        if (!config.database.uri) {
          throw new Error('MongoDB URI no configurada');
        }
        logger.debug('Usando base de datos MongoDB');
        this.db = new MongoDatabase(config.database.uri);
        break;

      case 'sqlite':
        logger.debug('Usando base de datos SQLite');
        // index.ts already bootstrapped the engine at startup; reuse it
        // (ensureDatabaseInitialized is a no-op when the engine is live).
        await ensureDatabaseInitialized();
        this.db = new SQLiteAdapter();
        break;

      default:
        logger.warn(`Tipo de base de datos no reconocido: ${dbType}, usando SQLite por defecto`);
        await ensureDatabaseInitialized();
        this.db = new SQLiteAdapter();
    }

    await this.db.connect();
  }

  /**
   * Stops background timers and closes the database.
   * Failures are logged rather than thrown so a shutdown problem cannot prevent
   * the remaining cleanup steps from running.
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Cerrando servicios...');
      cleanupService.stop();
      this.sessionBackupService.stop();
      this.autoRestartService.stop();
      persistenceService.stop();
      antiDeleteService.stop();
      if (this.db) {
        await this.db.disconnect();
      }

      logger.info('Servicios cerrados correctamente');
    } catch (error) {
      logError('ServiceManager.shutdown', error);
    }
  }

  /** True once the database is connected. Used to guard best-effort counter updates. */
  isReady(): boolean {
    return this.db && this.db.isConnected();
  }
}

export const serviceManager = ServiceManager.getInstance();
