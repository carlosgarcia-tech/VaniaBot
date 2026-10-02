import { spawn, type ChildProcess } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { mostrarBannerVania, seleccionarMetodoAuth } from './utils/cli.js';
import { env } from './config/env.js';
import { logger, logError } from '@/utils/logger.js';

const SESSION_DIR = env.SESSION_PATH;
const SESSION_CREDS = `${SESSION_DIR}/creds.json`;
const BOOT_FLAG = './data/.vania-session';
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
  console.info(chalk.bold.hex('#FF1493')('\n🦋─ Iniciando VaniaBot IA ─🦋\n'));
} else {
  logger.info(chalk.bold.hex('#FF1493')('\n🦋─ Iniciando VaniaBot IA ─🦋\n'));
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
      `🔄 Reiniciando en ${delayMs / 1000}s... (Intento ${restartCount}/${MAX_QUICK_RESTARTS})`,
    ),
  );
  setTimeout(() => {
    isAuthenticated = false;
    startBot(authMode);
  }, delayMs);
}

function scheduleDelayedRestartAfterFlood(authMode: 'qr' | 'code'): void {
  logger.info(chalk.red(`\n Demasiados reinicios (${restartCount}) en poco tiempo`));
  logger.info(chalk.yellow(`⏳ Esperando ${FORCE_RESTART_WAIT_MS / 1000}s antes de reintentar...`));
  setTimeout(() => {
    restartCount = 0;
    firstRestartTime = null;
    isAuthenticated = false;
    startBot(authMode);
  }, FORCE_RESTART_WAIT_MS);
}

function startBot(authMode: 'qr' | 'code'): void {
  if (isRunning) {
    logger.info(chalk.yellow('⚠️ El bot ya está ejecutándose'));
    return;
  }

  isRunning = true;
  if (IS_DOCKER) {
    console.info(chalk.cyan('▶ Iniciando VaniaBot...\n'));
  } else {
    logger.info(chalk.cyan('▶ Iniciando VaniaBot...\n'));
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
      logger.info(chalk.green('\n Bot autenticado y listo para operar'));
      isAuthenticated = true;
      restartCount = 0;
      firstRestartTime = null;
    }
  });

  childProcess.on('exit', (code, signal) => {
    isRunning = false;
    childProcess = null;

    logger.info(
      chalk.yellow(`\n⚠️ Proceso finalizado (código: ${code}, señal: ${signal ?? 'ninguna'})`),
    );

    if (signal === 'SIGTERM' || signal === 'SIGKILL' || code === 130) {
      logger.info(chalk.green('✓ VaniaBot cerrado correctamente'));
      process.exit(0);
    }

    if (code === 0 && isAuthenticated) {
      logger.info(chalk.green('✓ VaniaBot cerrado correctamente'));
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
    logError('Error en proceso hijo:', err);
    isRunning = false;
    childProcess = null;

    logger.info(chalk.yellow('⏳ Reintentando en 5 segundos...'));
    setTimeout(() => {
      isAuthenticated = false;
      startBot(authMode);
    }, 5_000);
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(chalk.yellow(`\n⚠️ Recibida señal ${signal}`));
  logger.info(chalk.cyan('🛑 Cerrando VaniaBot de forma segura...'));

  if (childProcess) {
    childProcess.kill('SIGTERM');

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        logger.info(chalk.red('⚠️ Forzando cierre del proceso hijo...'));
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
    logger.warn('[Vania] Boot flag cleanup error (non-fatal):', error);
  }

  logger.info(chalk.green('✓ VaniaBot cerrado correctamente'));
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
  logError('Error no capturado:', err);
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
  logError('Promesa rechazada no manejada:', reason);
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

  logger.info(chalk.yellow('\nConfiguración de número de teléfono'));
  logger.info(chalk.gray('   Formato: +[código país][número]'));
  logger.info(chalk.gray('   Ejemplo: +529514639799\n'));

  const phone = await new Promise<string>(resolve => {
    rl.question(chalk.cyan('➤ Ingresa tu número de WhatsApp: '), answer => resolve(answer.trim()));
  });

  rl.close();

  if (!phone) {
    logger.info(chalk.red(' No se ingresó número. Saliendo...'));
    process.exit(1);
  }

  const cleaned = phone.replace(/\s/g, '');
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    logger.info(chalk.red(' Formato de número inválido'));
    logger.info(chalk.yellow('   Debe contener entre 10-15 dígitos'));
    logger.info(chalk.yellow('   Puede incluir + al inicio'));
    process.exit(1);
  }

  const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  process.env.PHONE_NUMBER = formatted;

  logger.info(chalk.green(`✓ Número configurado: ${formatted}\n`));
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
    logInfo(chalk.cyan('Usando método: ') + chalk.bold.green('Código QR'));
  } else if (cliAuthMode === 'code') {
    selectedAuthMode = 'code';
    logInfo(chalk.cyan('Usando método: ') + chalk.bold.green('Código de Pareamiento'));
  } else if (cliAuthMode) {
    logger.info(
      chalk.red(
        `\n Argumento inválido: "${cliAuthMode}"\n\n` +
          'Uso correcto:\n' +
          '   npm start qr     → Usar código QR\n' +
          '   npm start code   → Usar código de pareamiento\n' +
          '   npm start        → Mostrar menú interactivo\n',
      ),
    );
    process.exit(1);
  } else if (hasExistingSession()) {
    logInfo(chalk.yellow('⚡ Sesión existente detectada, arrancando directamente...\n'));
    selectedAuthMode = 'qr';
  } else if (IS_DOCKER) {
    logInfo(chalk.cyan('Usando método: ') + chalk.bold.green('Código QR'));
    selectedAuthMode = 'qr';
  } else {
    if (!existsSync(BOOT_FLAG)) {
      await mostrarBannerVania();
    } else {
      logger.info(chalk.yellow('⚡ Detectado arranque previo, saltando animación...\n'));
    }
    selectedAuthMode = await seleccionarMetodoAuth();
  }

  if (selectedAuthMode === 'code' && !process.env.PHONE_NUMBER) {
    await promptPhoneNumber();
  }

  if (!existsSync(BOOT_FLAG)) {
    writeFileSync(BOOT_FLAG, 'VANIA_RUNNING');
  }

  startBot(selectedAuthMode);
}

main().catch(error => {
  logError('Error fatal:', error);
  process.exit(1);
});
