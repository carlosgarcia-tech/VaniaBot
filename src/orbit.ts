/**
 * orbit.ts
 *
 * OrbitBot orbit.ts module (internal helpers).
 *
 * @author **Carlos G**
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { displayOrbitBanner, selectAuthMethod } from './utils/cli.js';
import { env } from './config/env.js';
import { logger, logError } from '@/utils/logger.js';

const SESSION_DIR = env.SESSION_PATH;
const SESSION_CREDS = `${SESSION_DIR}/creds.json`;
const BOOT_FLAG = './data/.orbit-session';
const MAX_QUICK_RESTARTS = env.MAX_QUICK_RESTARTS;
const RESTART_WINDOW_MS = env.RESTART_WINDOW_MS;
const MAX_RESTART_DELAY_MS = env.MAX_RESTART_DELAY_MS;
const FORCE_RESTART_WAIT_MS = env.FORCE_RESTART_WAIT_MS;

const IS_DOCKER =
  process.env.DOCKER === 'true' || process.env.DOCKER_MODE === 'true' || existsSync('/.dockerenv');

let isRunning = false;
let childProcess: ChildProcess | null = null;
let restartCount = 0;
let firstRestartTime: number | null = null;
let isAuthenticated = false;
let shutdownRegistered = false;

if (IS_DOCKER) {
  console.info(chalk.bold.hex('#FF1493')('\n🦋─ Starting OrbitBot AI ─🦋\n'));
} else {
  logger.info(chalk.bold.hex('#FF1493')('\n🦋─ Starting OrbitBot AI ─🦋\n'));
}

function hasExistingSession(): boolean {
  return existsSync(SESSION_CREDS);
}

function resetRestartCounterIfWindowExpired(): void {
  if (firstRestartTime && Date.now() - firstRestartTime > RESTART_WINDOW_MS) {
    restartCount = 0;
    firstRestartTime = null;
  }
}

function scheduleRestart(authMode: 'qr' | 'code', delayMs: number): void {
  logger.info(
    chalk.cyan(
      `🔄 Restarting in ${delayMs / 1000}s... (Attempt ${restartCount}/${MAX_QUICK_RESTARTS})`,
    ),
  );
  setTimeout(() => {
    isAuthenticated = false;
    startBot(authMode);
  }, delayMs);
}

function scheduleDelayedRestartAfterFlood(authMode: 'qr' | 'code'): void {
  logger.info(chalk.red(`\n Too many restarts (${restartCount}) in a short time`));
  logger.info(chalk.yellow(`⏳ Waiting ${FORCE_RESTART_WAIT_MS / 1000}s before retrying...`));
  setTimeout(() => {
    restartCount = 0;
    firstRestartTime = null;
    isAuthenticated = false;
    startBot(authMode);
  }, FORCE_RESTART_WAIT_MS);
}

function startBot(authMode: 'qr' | 'code'): void {
  if (isRunning) {
    logger.info(chalk.yellow('⚠️ Bot is already running'));
    return;
  }

  isRunning = true;
  if (IS_DOCKER) {
    console.info(chalk.cyan('▶ Starting OrbitBot...\n'));
  } else {
    logger.info(chalk.cyan('▶ Starting OrbitBot...\n'));
  }

  const dockerEnv: Record<string, string> = {};
  if (IS_DOCKER) {
    const categories = ['LOG_SYSTEM', 'LOG_AI', 'LOG_DATABASE', 'LOG_MODERATION', 'LOG_NETWORK'];
    for (const cat of categories) {
      dockerEnv[cat] = process.env[cat] || 'warn';
    }
  }

  childProcess = spawn('node_modules/.bin/tsx', ['src/index.ts'], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      ...dockerEnv,
      USE_PAIRING_CODE: authMode === 'code' ? 'true' : 'false',
      LOG_LEVEL: IS_DOCKER ? process.env.LOG_LEVEL || 'warn' : process.env.LOG_LEVEL || 'info',
    },
  });

  childProcess.on('message', message => {
    if (message === 'ready') {
      logger.info(chalk.green('\n Bot authenticated and ready'));
      isAuthenticated = true;
      restartCount = 0;
      firstRestartTime = null;
    }
  });

  childProcess.on('exit', (code, signal) => {
    isRunning = false;
    childProcess = null;

    logger.info(chalk.yellow(`\n⚠️ Process exited (code: ${code}, signal: ${signal ?? 'none'})`));

    if (signal === 'SIGTERM' || signal === 'SIGKILL' || code === 130) {
      logger.info(chalk.green('✓ OrbitBot stopped cleanly'));
      process.exit(0);
    }

    if (code === 0 && isAuthenticated) {
      logger.info(chalk.green('✓ OrbitBot stopped cleanly'));
      process.exit(0);
    }

    resetRestartCounterIfWindowExpired();

    if (!firstRestartTime) firstRestartTime = Date.now();
    restartCount++;

    if (restartCount > MAX_QUICK_RESTARTS) {
      scheduleDelayedRestartAfterFlood(authMode);
      return;
    }

    const delay = Math.min(5_000 * restartCount, MAX_RESTART_DELAY_MS);
    scheduleRestart(authMode, delay);
  });

  childProcess.on('error', err => {
    logError('Error in child process:', err);
    isRunning = false;
    childProcess = null;

    logger.info(chalk.yellow('⏳ Retrying in 5 seconds...'));
    setTimeout(() => {
      isAuthenticated = false;
      startBot(authMode);
    }, 5_000);
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(chalk.yellow(`\n⚠️ Received signal ${signal}`));
  logger.info(chalk.cyan('🛑 Shutting OrbitBot down safely...'));

  if (childProcess) {
    childProcess.kill('SIGTERM');

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        logger.info(chalk.red('⚠️ Force-killing child process...'));
        childProcess?.kill('SIGKILL');
        resolve();
      }, 10_000);

      childProcess?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  try {
    if (existsSync(BOOT_FLAG)) unlinkSync(BOOT_FLAG);
  } catch (error) {
    logger.warn('[Orbit] Boot flag cleanup error (non-fatal):', error);
  }

  logger.info(chalk.green('✓ OrbitBot stopped cleanly'));
  process.exit(0);
}

if (!shutdownRegistered) {
  shutdownRegistered = true;
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
}

process.on('uncaughtException', err => {
  logError('Uncaught error:', err);
  if (childProcess) {
    childProcess.kill('SIGTERM');
    setTimeout(() => {
      if (childProcess) childProcess.kill('SIGKILL');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', reason => {
  logError('Unhandled promise rejection:', reason);
  if (childProcess) {
    childProcess.kill('SIGTERM');
    setTimeout(() => {
      if (childProcess) childProcess.kill('SIGKILL');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(1);
  }
});

async function promptPhoneNumber(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  logger.info(chalk.yellow('\nPhone number setup'));
  logger.info(chalk.gray('   Format: +[country code][number]'));
  logger.info(chalk.gray('   Example: +529514639799\n'));

  const phone = await new Promise<string>(resolve => {
    rl.question(chalk.cyan('➤ Enter your WhatsApp number: '), answer => resolve(answer.trim()));
  });

  rl.close();

  if (!phone) {
    logger.info(chalk.red(' No number entered. Exiting...'));
    process.exit(1);
  }

  const cleaned = phone.replace(/\s/g, '');
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    logger.info(chalk.red(' Invalid number format'));
    logger.info(chalk.yellow('   Must contain 10-15 digits'));
    logger.info(chalk.yellow('   It may start with +'));
    process.exit(1);
  }

  const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  process.env.PHONE_NUMBER = formatted;

  logger.info(chalk.green(`✓ Number configured: ${formatted}\n`));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cliAuthMode = args[0]?.toLowerCase();

  let selectedAuthMode: 'qr' | 'code';

  const logInfo = IS_DOCKER
    ? (msg: string) => console.info(msg)
    : (msg: string) => logger.info(msg);

  if (cliAuthMode === 'qr') {
    selectedAuthMode = 'qr';
    logInfo(chalk.cyan('Using method: ') + chalk.bold.green('QR Code'));
  } else if (cliAuthMode === 'code') {
    selectedAuthMode = 'code';
    logInfo(chalk.cyan('Using method: ') + chalk.bold.green('Pairing Code'));
  } else if (cliAuthMode) {
    logger.info(
      chalk.red(
        `\n Invalid argument: "${cliAuthMode}"\n\n` +
          'Usage:\n' +
          '   npm start qr     → Use QR code\n' +
          '   npm start code   → Use pairing code\n' +
          '   npm start        → Show interactive menu\n',
      ),
    );
    process.exit(1);
  } else if (hasExistingSession()) {
    logInfo(chalk.yellow('⚡ Existing session detected, starting directly...\n'));
    selectedAuthMode = 'qr';
  } else if (IS_DOCKER) {
    logInfo(chalk.cyan('Using method: ') + chalk.bold.green('QR Code'));
    selectedAuthMode = 'qr';
  } else {
    if (!existsSync(BOOT_FLAG)) {
      await displayOrbitBanner();
    } else {
      logger.info(chalk.yellow('⚡ Previous start detected, skipping animation...\n'));
    }
    selectedAuthMode = await selectAuthMethod();
  }

  if (selectedAuthMode === 'code' && !process.env.PHONE_NUMBER) {
    await promptPhoneNumber();
  }

  if (!existsSync(BOOT_FLAG)) {
    writeFileSync(BOOT_FLAG, 'ORBIT_RUNNING');
  }

  startBot(selectedAuthMode);
}

main().catch(error => {
  logError('Error fatal:', error);
  process.exit(1);
});
