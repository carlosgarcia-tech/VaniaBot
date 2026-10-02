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

class CategoryLogger {
  private category: string;
  private logger: pino.Logger;

  constructor(category: string) {
    this.category = category;
    this.logger = createPinoLogger(category);
  }

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

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(this.formatMessage('warn', message, meta));
  }

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

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(this.formatMessage('debug', message, meta));
  }

  child(_bindings: Record<string, unknown>): CategoryLogger {
    const child = new CategoryLogger(this.category);
    return child;
  }
}

class MainLogger {
  private categoryLoggers: Map<string, CategoryLogger> = new Map();

  readonly system = this.getLogger('system');
  readonly commands = this.getLogger('commands');
  readonly database = this.getLogger('database');
  readonly ai = this.getLogger('ai');
  readonly download = this.getLogger('download');
  readonly moderation = this.getLogger('moderation');
  readonly economy = this.getLogger('economy');
  readonly network = this.getLogger('network');

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

  info(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.error(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    const logger = this.getLogger('system');
    logger.debug(message, meta);
  }

  audit(action: string, details: Record<string, unknown>): void {
    const auditLog = this.getLogger('system');
    auditLog.info(`[AUDIT] ${action}`, {
      ...details,
      audit: true,
      userAgent: process.env.NODE_ENV,
    });
  }

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

class AsyncLogger {
  private queue: Array<{ level: string; args: unknown[] }> = [];
  private isProcessing = false;
  private processTimer: NodeJS.Timeout | null = null;

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

  private schedule(level: string, ...args: unknown[]): void {
    this.queue.push({ level, args });

    if (!this.processTimer) {
      this.processTimer = setTimeout(() => {
        this.processTimer = null;
        void this.processQueue();
      }, 100);
    }
  }

  info(...args: unknown[]): void {
    if (LOG_LEVEL === 'error' || LOG_LEVEL === 'warn') return;
    this.schedule('info', ...args);
  }

  warn(...args: unknown[]): void {
    if (LOG_LEVEL === 'error') return;
    this.schedule('warn', ...args);
  }

  error(...args: unknown[]): void {
    this.schedule('error', ...args);
  }

  debug(...args: unknown[]): void {
    if (LOG_LEVEL !== 'debug') return;
    this.schedule('debug', ...args);
  }

  async flush(): Promise<void> {
    await this.processQueue();
  }
}

export const logger = new AsyncLogger();

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
