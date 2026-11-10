/**
 * index.ts
 *
 * Barrel module re-exporting the index.ts layer's public API.
 *
 * @author **Carlos G**
 */

import { WhatsAppClient } from './core/Client.js';
import { logger, logError } from './utils/logger.js';
import { panelServer } from './services/webhook/PanelServer.js';
import { initializeDatabase } from './repositories/Database.js';
import { subBotDatabase } from './services/subbot/SubBotDatabase.js';
import { databaseSwitcher } from './services/system/DatabaseSwitcher.js';
import { createStartupProgress, displayOrbitBanner } from './utils/cli.js';
import { existsSync, writeFileSync, unlinkSync } from 'fs';

/**
 * Written when the dev startup renders the CLI banner, so a tsx watch restart
 * skips the animation just like the orbit.ts supervisor does for real boots.
 */
const BOOT_FLAG = './data/.orbit-session';
let renderedBanner = false;

const originalConsoleError = console.error;
console.error = function (...args: unknown[]) {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('Bad MAC') || msg.includes('Failed to decrypt') || msg.includes('Session error'))
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

let client: WhatsAppClient;

async function main(): Promise<void> {
  const isDocker = process.env.DOCKER_MODE === 'true' || process.env.DOCKER === 'true';
  const isDev = !isDocker && process.env.NODE_ENV === 'development';
  const startupProgress = isDocker || isDev ? createStartupProgress() : null;

  if (isDev && !existsSync(BOOT_FLAG)) {
    // dev boots straight into index.ts (no supervisor), so the CLI render
    // lives here and only on the first boot of a session.
    await displayOrbitBanner();
    writeFileSync(BOOT_FLAG, 'ORBIT_RUNNING');
    renderedBanner = true;
  }

  if (!isDocker) {
    logger.info('Iniciando WhatsApp Bot...');
  }

  try {
    if (startupProgress) startupProgress.begin('Base de datos');
    await databaseSwitcher.initialize();
    await initializeDatabase();
    await subBotDatabase.initialize();
    if (startupProgress) startupProgress.done('Base de datos');
  } catch (error) {
    if (startupProgress) {
      startupProgress.fail('Base de datos', error instanceof Error ? error.message : String(error));
    }
    logger.warn('⚠️ Error inicializando base de datos, continuando sin ella:', error);
  }

  if (startupProgress) {
    startupProgress.finalize();
  }

  client = new WhatsAppClient();
  // Expose globally so HealthCheckService / panel routers can read metrics.
  globalThis.client = client;

  // The panel must not depend on the WhatsApp connection: an account that
  // hangs waiting for QR or pairing would otherwise never expose the panel.
  const disablePanel = process.env.PANEL_DISABLED === 'true';
  if (!disablePanel) {
    await panelServer.start();
  }

  await client.initialize();

  if (!isDocker) {
    logger.info('Bot iniciado correctamente');
  }
}

async function shutdown(reason: string): Promise<void> {
  logger.info(`Deteniendo bot (${reason})...`);
  try {
    if (client) {
      await client.shutdown();
    }
    await panelServer.stop();
    await logger.flush();
  } catch (error) {
    logError('shutdown', error);
  }

  if (renderedBanner && existsSync(BOOT_FLAG)) {
    try {
      unlinkSync(BOOT_FLAG);
    } catch {
      /* non-fatal: the next boot just skips the banner animation */
    }
  }

  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(err => logError('SIGINT handler', err));
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(err => logError('SIGTERM handler', err));
});

process.on('uncaughtException', error => {
  logError('Uncaught Exception', error);
});

process.on('unhandledRejection', reason => {
  logError('Unhandled Rejection', reason);
});

main().catch(error => {
  logError('main', error);
  // Fatal startup error: exit non-zero so the orbit.ts supervisor restarts us.
  // Staying alive here would leave a zombie bot with no connection and no panel.
  void logger.flush().finally(() => {
    process.exit(1);
  });
});
