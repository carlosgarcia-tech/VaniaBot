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
import { ensureDatabaseInitialized } from '@/repositories/Database.js';

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
  public healthCheckService = healthCheckService;
  public autoRestartService = AutoRestartService.getInstance();
  public sessionBackupService = sessionBackupService;
  public persistenceService = persistenceService;

  private constructor() {}

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

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

  async shutdown(): Promise<void> {
    try {
      logger.info('Cerrando servicios...');
      cleanupService.stop();
      this.sessionBackupService.stop();
      if (this.db) {
        await this.db.disconnect();
      }

      logger.info('Servicios cerrados correctamente');
    } catch (error) {
      logError('ServiceManager.shutdown', error);
    }
  }

  isReady(): boolean {
    return this.db && this.db.isConnected();
  }
}

export const serviceManager = ServiceManager.getInstance();
