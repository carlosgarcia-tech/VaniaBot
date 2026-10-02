import pino from 'pino';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_DIR = join(process.cwd(), 'logs');

const LOG_CATEGORIES = {
  system: process.env.LOG_SYSTEM || 'info',
  commands: process.env.LOG_COMMANDS || 'warn',
  database: process.env.LOG_DATABASE || 'info',
  ai: process.env.LOG_AI || 'info',
  download: process.env.LOG_DOWNLOAD || 'warn',
  moderation: process.env.LOG_MODERATION || 'info',
  economy: process.env.LOG_ECONOMY || 'warn',
  network: process.env.LOG_NETWORK || 'info',
};

if (IS_PRODUCTION && !existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Creates a Pino logger instance for a specific category.
 *
 * @param category - Optional log category name.
 * @returns A configured Pino logger instance.
 */
const createPinoLogger = (category?: string) => {
  const categoryLevel = category
    ? LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES] || LOG_LEVEL
    : LOG_LEVEL;

  if (IS_PRODUCTION) {
    const stream = category
      ? createWriteStream(join(LOG_DIR, `vania-${category}.log`), { flags: 'a' })
      : createWriteStream(join(LOG_DIR, 'vania.log'), { flags: 'a' });

    return pino(
      {
        level: categoryLevel,
        formatters: {
          level: label => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      stream,
    );
  }

  return pino({
    level: categoryLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        minimumLevel: 'warn',
        customColors: {
          info: 'green',
          warn: 'yellow',
          error: 'red',
          debug: 'blue',
        },
      },
    },
  });
};

/**
 * CategoryLogger provides logging methods for a specific category.
 */
class CategoryLogger {
  private category: string;
  private logger: pino.Logger;

  /**
   * Creates a new CategoryLogger.
   *
   * @param category - The log category name.
   */
  constructor(category: string) {
    this.category = category;
    this.logger = createPinoLogger(category);
  }

  /**
   * Formats a log message with metadata.
   *
   * @param level - The log level.
   * @param message - The log message.
   * @param meta - Optional metadata object.
   * @returns Formatted log object.
   */
  private formatMessage(
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ): Record<string, unknown> {
    const base = {
      timestamp: new Date().toISOString(),
      category: this.category,
      level,
      message,
    };

    if (meta) {
      return { ...base, ...meta };
    }
    return base;
  }

  /**
   * Logs an info level message.
   *
   * @param message - The log message.
   * @param meta - Optional metadata.
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(this.formatMessage('info', message, meta));
  }

  /**
   * Logs a warning level message.
   *
   * @param message - The log message.
   * @param meta - Optional metadata.
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(this.formatMessage('warn', message, meta));
  }

  /**
   * Logs an error level message.
   *
   * @param message - The log message.
   * @param meta - Optional metadata (can include an Error object).
   */
  error(message: string, meta?: Record<string, unknown>): void {
    const errorMeta =
      meta?.error instanceof Error
        ? {
            ...meta,
            error: {
              message: meta.error.message,
              stack: IS_PRODUCTION ? undefined : meta.error.stack,
              name: meta.error.name,
            },
          }
        : meta;
    this.logger.error(this.formatMessage('error', message, errorMeta));
  }

  /**
   * Logs a debug level message.
   *
   * @param message - The log message.
   * @param meta - Optional metadata.
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(this.formatMessage('debug', message, meta));
  }

  /**
   * Creates a child logger (returns a new CategoryLogger instance).
   *
   * @param bindings - Optional bindings for the child logger.
   * @returns A new CategoryLogger instance.
   */
  child(bindings: Record<string, unknown>): CategoryLogger {
    const child = new CategoryLogger(this.category);
    return child;
  }
}

/**
 * MainLogger manages multiple category loggers and provides a unified interface.
 */
class MainLogger {
  private categoryLoggers: Map<string, CategoryLogger> = new Map();

  readonly system: CategoryLogger;
  readonly commands: CategoryLogger;
  readonly database: CategoryLogger;
  readonly ai: CategoryLogger;
  readonly download: CategoryLogger;
  readonly moderation: CategoryLogger;
  readonly economy: CategoryLogger;
  readonly network: CategoryLogger;

  constructor() {
    this.system = this.getLogger('system');
    this.commands = this.getLogger('commands');
    this.database = this.getLogger('database');
    this.ai = this.getLogger('ai');
    this.download = this.getLogger('download');
    this.moderation = this.getLogger('moderation');
    this.economy = this.getLogger('economy');
    this.network = this.getLogger('network');
  }

  /**
   * Gets or creates a CategoryLogger for the given category.
   *
   * @param category - The category name.
   * @returns The CategoryLogger instance.
   */
  private getLogger(category: string): CategoryLogger {
    if (!this.categoryLoggers.has(category)) {
      this.categoryLoggers.set(category, new CategoryLogger(category));
    }
    const loggerInstance = this.categoryLoggers.get(category);
    if (!loggerInstance) {
      throw new Error(`Failed to create logger for category: ${category}`);
    }
    return loggerInstance;
  }

  /**
   * Logs an info level message to the system logger.
   */
  info(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.info(message, meta);
  }

  /**
   * Logs a warning level message to the system logger.
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.warn(message, meta);
  }

  /**
   * Logs an error level message to the system logger.
   */
  error(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.error(message, meta);
  }

  /**
   * Logs a debug level message to the system logger.
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.debug(message, meta);
  }

  /**
   * Logs an audit event.
   *
   * @param action - The audit action name.
   * @param details - Additional audit details.
   */
  audit(action: string, details: Record<string, unknown>): void {
    const auditLog = this.getLogger('system');
    auditLog.info(`[AUDIT] ${action}`, {
      ...details,
      audit: true,
      userAgent: process.env.NODE_ENV,
    });
  }

  /**
   * Gets a category logger by name.
   *
   * @param category - The category name.
   * @returns The CategoryLogger instance.
   */
  getCategoryLogger(category: keyof typeof LOG_CATEGORIES): CategoryLogger {
    return this.getLogger(category);
  }
}

export const structuredLogger = new MainLogger();

const CONSOLE_LOG_ENABLED = process.env.CONSOLE_LOG !== 'false';

const logStream = IS_PRODUCTION
  ? createWriteStream(join(process.cwd(), 'logs', 'vania.log'), { flags: 'a' })
  : process.stdout;

const fileLogger = IS_PRODUCTION
  ? pino(
      {
        formatters: {
          level: label => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      logStream,
    )
  : null;

const consoleLogger = !IS_PRODUCTION
  ? pino({
      level: LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          minimumLevel: 'warn',
        },
      },
    })
  : pino();

type PinoLogger = typeof fileLogger | typeof consoleLogger;
function pinoLog(pinoInst: PinoLogger, level: string, args: unknown[]): void {
  if (!pinoInst) return;
  (pinoInst as unknown as Record<string, (...a: unknown[]) => void>)[level]?.(...args);
}

/**
 * AsyncLogger provides asynchronous logging with batching.
 * Queues log entries and processes them in batches to avoid blocking.
 */
class AsyncLogger {
  private queue: Array<{ level: string; args: unknown[] }> = [];
  private isProcessing = false;
  private processTimer: NodeJS.Timeout | null = null;

  /**
   * Processes the log queue in batches.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const batch = this.queue.splice(0, 100);

    for (const { level, args } of batch) {
      if (IS_PRODUCTION) {
        pinoLog(fileLogger, level, args);
        if (CONSOLE_LOG_ENABLED) {
          pinoLog(consoleLogger, level, args);
        }
      } else {
        pinoLog(consoleLogger, level, args);
      }
    }

    this.isProcessing = false;

    if (this.queue.length > 0) {
      setImmediate(() => {
        void this.processQueue();
      });
    }
  }

  /**
   * Schedules a log entry for processing.
   *
   * @param level - The log level.
   * @param args - The log arguments.
   */
  private schedule(level: string, ...args: unknown[]): void {
    this.queue.push({ level, args });

    if (!this.processTimer) {
      this.processTimer = setTimeout(() => {
        this.processTimer = null;
        void this.processQueue();
      }, 100);
    }
  }

  /**
   * Logs an info level message (skipped if log level is error or warn).
   */
  info(...args: unknown[]): void {
    if (LOG_LEVEL === 'error' || LOG_LEVEL === 'warn') return;
    this.schedule('info', ...args);
  }

  /**
   * Logs a warning level message (skipped if log level is error).
   */
  warn(...args: unknown[]): void {
    if (LOG_LEVEL === 'error') return;
    this.schedule('warn', ...args);
  }

  /**
   * Logs an error level message.
   */
  error(...args: unknown[]): void {
    this.schedule('error', ...args);
  }

  /**
   * Logs a debug level message (only if log level is debug).
   */
  debug(...args: unknown[]): void {
    if (LOG_LEVEL !== 'debug') return;
    this.schedule('debug', ...args);
  }

  /**
   * Flushes the log queue.
   *
   * @returns A promise that resolves when the queue is empty.
   */
  async flush(): Promise<void> {
    await this.processQueue();
  }
}

export const logger = new AsyncLogger();

/**
 * Logs an error with context information.
 *
 * @param context - The context where the error occurred.
 * @param error - The error object or value.
 */
export function logError(context: string, error: unknown): void {
  if (error instanceof Error) {
    logger.error({
      context,
      message: error.message,
      stack: IS_PRODUCTION ? undefined : error.stack,
      name: error.name,
    });
  } else {
    logger.error({ context, error: String(error) });
  }
}