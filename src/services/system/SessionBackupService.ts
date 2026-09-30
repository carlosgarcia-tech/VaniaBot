import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from 'fs';
import { join, dirname } from 'path';
import { logger } from '@/utils/logger.js';

export interface BackupOptions {
  enabled: boolean;
  intervalMinutes: number;
  maxBackups: number;
  backupPath: string;
  compressBackups: boolean;
}

export interface BackupInfo {
  timestamp: number;
  path: string;
  size: number;
  files: string[];
}

const DEFAULT_OPTIONS: BackupOptions = {
  enabled: true,
  intervalMinutes: 30,
  maxBackups: 5,
  backupPath: './data/backups',
  compressBackups: false,
};

export class SessionBackupService {
  private static instance: SessionBackupService;
  private options: BackupOptions;
  private backupInterval: NodeJS.Timeout | null = null;
  private lastBackupTime: number | null = null;
  private isRunning = false;

  private readonly sessionDir = './vaniasession';
  private readonly sessionFiles = ['creds.json', 'pre-key-*', 'session-*', 'app-state-*'];

  private constructor(options: Partial<BackupOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  static getInstance(options?: Partial<BackupOptions>): SessionBackupService {
    if (!SessionBackupService.instance) {
      SessionBackupService.instance = new SessionBackupService(options);
    }
    return SessionBackupService.instance;
  }

  async start(): Promise<void> {
    if (!this.options.enabled) {
      logger.info('Session backup service is disabled');
      return;
    }

    if (this.isRunning) {
      logger.warn('Session backup service is already running');
      return;
    }

    if (!existsSync(this.sessionDir)) {
      logger.warn(`Session directory not found: ${this.sessionDir}`);
      return;
    }

    if (!existsSync(this.options.backupPath)) {
      mkdirSync(this.options.backupPath, { recursive: true });
    }

    await this.performBackup();

    this.backupInterval = setInterval(
      () => {
        try {
          void this.performBackup();
        } catch (error) {
          logger.error('[SessionBackup] Scheduled backup error:', error);
        }
      },
      this.options.intervalMinutes * 60 * 1000,
    );
    this.backupInterval.unref();

    this.isRunning = true;
    logger.debug(
      `📦 Session backup service started (every ${this.options.intervalMinutes} minutes)`,
    );
  }

  stop(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
    this.isRunning = false;
    logger.info('Session backup service stopped');
  }

  async performBackup(): Promise<BackupInfo | null> {
    try {
      if (!existsSync(this.sessionDir)) {
        logger.warn(`Session directory not found: ${this.sessionDir}`);
        return null;
      }

      const timestamp = Date.now();
      const backupName = `session_backup_${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}`;
      const backupDir = join(this.options.backupPath, backupName);

      mkdirSync(backupDir, { recursive: true });

      const sessionFiles = this.getSessionFiles();
      const files: string[] = [];

      for (const file of sessionFiles) {
        const srcPath = join(this.sessionDir, file);
        const destPath = join(backupDir, file);

        if (existsSync(srcPath)) {
          const destDir = dirname(destPath);
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }
          copyFileSync(srcPath, destPath);
          files.push(file);
        }
      }

      const metadata = {
        timestamp,
        version: '1.0.0',
        files,
        botVersion: process.env.BOT_NAME || 'VaniaBot',
      };

      writeFileSync(join(backupDir, 'backup_metadata.json'), JSON.stringify(metadata, null, 2));

      this.cleanOldBackups();

      this.lastBackupTime = timestamp;

      const size = this.getDirectorySize(backupDir);

      logger.debug(
        `📦 Backup created: ${backupName} (${(size / 1024).toFixed(2)} KB, ${files.length} files)`,
      );

      return {
        timestamp,
        path: backupDir,
        size,
        files,
      };
    } catch (error) {
      logger.error('Failed to perform backup', { error });
      return null;
    }
  }

  private getSessionFiles(): string[] {
    const files: string[] = [];

    if (!existsSync(this.sessionDir)) {
      return files;
    }

    try {
      const dirFiles = readdirSync(this.sessionDir);

      files.push(
        ...dirFiles.filter(
          f =>
            f === 'creds.json' ||
            f.startsWith('pre-key-') ||
            f.startsWith('session-') ||
            f.startsWith('app-state-'),
        ),
      );
    } catch (error) {
      logger.error('Error reading session directory', { error });
    }

    return files;
  }

  private cleanOldBackups(): void {
    try {
      if (!existsSync(this.options.backupPath)) {
        return;
      }

      const backups = readdirSync(this.options.backupPath)
        .filter(f => f.startsWith('session_backup_'))
        .map(f => ({
          name: f,
          path: join(this.options.backupPath, f),
          time: statSync(join(this.options.backupPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (backups.length > this.options.maxBackups) {
        const toDelete = backups.slice(this.options.maxBackups);
        for (const backup of toDelete) {
          try {
            rmSync(backup.path, { recursive: true, force: true });
            logger.debug(`🗑️ Old backup deleted: ${backup.name}`);
          } catch (error) {
            logger.error(`Failed to delete old backup: ${backup.name}`, { error });
          }
        }
      }
    } catch (error) {
      logger.error('Error cleaning old backups', { error });
    }
  }

  private getDirectorySize(dirPath: string): number {
    let size = 0;

    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        const filePath = join(dirPath, file);
        const stats = statSync(filePath);
        if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      logger.debug(`[SessionBackup] Could not measure size of ${dirPath}:`, error);
    }

    return size;
  }

  async restoreBackup(backupName?: string): Promise<boolean> {
    try {
      if (!existsSync(this.options.backupPath)) {
        logger.error('Backup directory not found');
        return false;
      }

      const backups = readdirSync(this.options.backupPath)
        .filter(f => f.startsWith('session_backup_'))
        .map(f => ({
          name: f,
          path: join(this.options.backupPath, f),
          time: statSync(join(this.options.backupPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (backups.length === 0) {
        logger.error('No backups found');
        return false;
      }

      const selectedBackup = backupName
        ? backups.find(b => b.name === backupName) || backups[0]
        : backups[0];

      logger.info(`📦 Restoring backup: ${selectedBackup.name}`);

      if (!existsSync(selectedBackup.path)) {
        logger.error('Backup path not found');
        return false;
      }

      const backupDir = selectedBackup.path;
      const metadataPath = join(backupDir, 'backup_metadata.json');

      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        logger.info(`Backup contains ${metadata.files?.length || 0} session files`);
      }

      if (!existsSync(this.sessionDir)) {
        mkdirSync(this.sessionDir, { recursive: true });
      }

      const backupFiles = readdirSync(backupDir).filter(f => f !== 'backup_metadata.json');

      for (const file of backupFiles) {
        const srcPath = join(backupDir, file);
        const destPath = join(this.sessionDir, file);

        if (statSync(srcPath).isDirectory()) {
          if (!existsSync(destPath)) {
            mkdirSync(destPath, { recursive: true });
          }
          this.copyDirectory(srcPath, destPath);
        } else {
          copyFileSync(srcPath, destPath);
        }
      }

      logger.info('✅ Backup restored successfully');
      return true;
    } catch (error) {
      logger.error('Failed to restore backup', { error });
      return false;
    }
  }

  private copyDirectory(src: string, dest: string): void {
    const files = readdirSync(src);
    for (const file of files) {
      const srcPath = join(src, file);
      const destPath = join(dest, file);
      if (statSync(srcPath).isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        this.copyDirectory(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  listBackups(): BackupInfo[] {
    const backups: BackupInfo[] = [];

    try {
      if (!existsSync(this.options.backupPath)) {
        return backups;
      }

      const backupDirs = readdirSync(this.options.backupPath)
        .filter(f => f.startsWith('session_backup_'))
        .map(f => join(this.options.backupPath, f))
        .filter(f => statSync(f).isDirectory());

      for (const dir of backupDirs) {
        const metadataPath = join(dir, 'backup_metadata.json');
        let metadata: Record<string, unknown> = {};

        if (existsSync(metadataPath)) {
          metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        }

        backups.push({
          timestamp: (metadata.timestamp as number) || statSync(dir).mtimeMs,
          path: dir,
          size: this.getDirectorySize(dir),
          files: (metadata.files as string[]) || [],
        });
      }
    } catch (error) {
      logger.error('Error listing backups', { error });
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  getLastBackupTime(): number | null {
    return this.lastBackupTime;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const sessionBackupService = SessionBackupService.getInstance();
