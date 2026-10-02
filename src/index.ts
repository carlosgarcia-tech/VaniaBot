import { WhatsAppClient } from './core/Client.js';
import { logger, logError } from './utils/logger.js';
import { panelServer } from './services/webhook/PanelServer.js';
import { initializeDatabase } from './repositories/Database.js';
import { subBotDatabase } from './services/subbot/SubBotDatabase.js';
import { databaseSwitcher } from './services/system/DatabaseSwitcher.js';
import { createStartupProgress } from './utils/cli.js';

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
  const startupProgress = isDocker ? createStartupProgress() : null;

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
  await client.initialize();

  if (!isDocker) {
    logger.info('Bot iniciado correctamente');
  }

  const disablePanel = process.env.PANEL_DISABLED === 'true';
  if (!disablePanel) {
    await panelServer.start();
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
  // Fatal startup error: exit non-zero so the vania.ts supervisor restarts us.
  // Staying alive here would leave a zombie bot with no connection and no panel.
  void logger.flush().finally(() => {
    process.exit(1);
  });
});
