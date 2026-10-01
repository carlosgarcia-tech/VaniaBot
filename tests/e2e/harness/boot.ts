/**
 * boot.ts
 *
 * Arranque real de WhatsAppClient para pruebas e2e, sin tocar WhatsApp ni
 * los datos locales del proyecto:
 *
 * 1. `vi.mock('@/core/WASocketFactory')` sustituye la única costura de
 *    conexión del bot por el FakeWASocket. Baileys real nunca llega a
 *    ejecutarse.
 * 2. El proceso corre en un cwd temporal aislado: la sesión vacía, la base
 *    de datos (`storage/`) y los stores JSON de `data/` caen ahí y no en
 *    el repositorio. `DB_TYPE=json` evita arrancar el motor SQLite de
 *    ServiceManager; el gestor de repositorios (sql.js) sí se inicializa
 *    porque el pipeline lo usa (dedupe, runtime state).
 *
 * El bot resultante es el de producción: mismos middlewares, mismo registro
 * de comandos vía PluginLoader, mismo pipeline. Solo la capa de transporte
 * es falsa.
 *
 * El arranque es único por proceso de test: Client/PluginLoader/commandRegistry
 * son singletons de módulo y no admiten un segundo boot en el mismo proceso.
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ quiet: true });

// Estas variables deben fijarse ANTES del primer import de '@/config'.
process.env.DB_TYPE = 'json';
process.env.PANEL_DISABLED = 'true';
process.env.LOG_LEVEL = 'error';
process.env.SESSION_PATH = './vaniasession';

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, vi } from 'vitest';
import { FakeWASocket } from './FakeWASocket.js';

vi.mock('@/core/WASocketFactory', () => ({
  FORCED_WA_VERSION: [2, 3000, 1043984129] as [number, number, number],
  SILENT_WA_LOGGER: { child: () => ({}) },
  WA_BROWSER_QR: ['VaniaBot', 'Chrome', '131.0.6778.0'] as [string, string, string],
  WA_BROWSER_PAIRING: ['Ubuntu', 'Chrome', '131.0.6778.0'] as [string, string, string],
  getWAVersion: () => [2, 3000, 1043984129] as [number, number, number],
  buildWASocketOptions: (args: { auth: unknown; overrides?: Record<string, unknown> }) => ({
    ...args.overrides,
    auth: args.auth,
  }),
  createCacheableKeyStore: (keys: unknown) => keys,
  createWASocket: vi.fn(() => new FakeWASocket()),
}));

export interface BootState {
  socket: FakeWASocket;
}

let bootState: BootState | null = null;
let tempDir: string | null = null;
const originalCwd = process.cwd();

// El bot llama a process.send('ready') al conectar (protocolo del supervisor
// vania.ts). En el worker de vitest ese canal IPC pertenece a tinypool:
// escribir en él corrompe el protocolo y el worker muere. El e2e no tiene
// supervisor, así que desactivamos el canal.
delete process.send;

/**
 * Arranca el bot real (Client.initialize) contra el FakeWASocket y emite
 * connection.update open, como haría Baileys al completar el handshake:
 * el pipeline fija mainBotId y el timestamp de arranque (filtro de ecos).
 */
export async function bootBot(): Promise<BootState> {
  if (bootState) return bootState;

  tempDir = mkdtempSync(join(tmpdir(), 'vania-e2e-'));
  process.chdir(tempDir);

  // Sesión simulada: el health check exige creds.json dentro de SESSION_PATH
  // y AuthManager usaría este directorio si el socket real existiera.
  mkdirSync(join(tempDir, 'vaniasession'), { recursive: true });
  writeFileSync(
    join(tempDir, 'vaniasession', 'creds.json'),
    JSON.stringify({ noiseKey: {}, signedIdentityKey: {}, registrationId: 1 }),
  );

  // Igual que index.ts: el gestor de repositorios (sql.js) antes del client.
  const { initializeDatabase, getDbManager } = await import('@/repositories/Database.js');
  await initializeDatabase();

  const { WhatsAppClient } = await import('@/core/Client.js');
  const client = new WhatsAppClient();
  await client.initialize();

  const socket = client.getSocket() as unknown as FakeWASocket;

  // Handshake completado: enciende ping/health-check de AuthManager y
  // registra mainBotId + startup timestamp en el pipeline.
  socket.emit('connection.update', { connection: 'open' });
  await new Promise(resolve => setTimeout(resolve, 50));

  bootState = { socket };

  afterAll(async () => {
    await client.shutdown();
    getDbManager()?.close();
    if (tempDir) {
      process.chdir(originalCwd);
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort: el directorio temporal puede quedar bloqueado
      }
      tempDir = null;
    }
  });

  return bootState;
}
