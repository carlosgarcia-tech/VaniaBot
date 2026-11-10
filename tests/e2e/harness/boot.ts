/**
 * boot.ts
 *
 * Real boot of WhatsAppClient for e2e tests, without touching WhatsApp or
 * the project's local data:
 *
 * 1. `vi.mock('@/core/WASocketFactory')` replaces the bot's only connection
 *    seam with the FakeWASocket. Real Baileys never gets to run.
 * 2. The process runs in an isolated temp cwd: the empty session, the
 *    database (`storage/`) and the JSON stores of `data/` land there and not
 *    in the repository. `DB_TYPE=json` avoids starting the SQLite engine of
 *    ServiceManager; the repository manager (sql.js) does initialize
 *    because the pipeline uses it (dedupe, runtime state).
 *
 * The resulting bot is the production one: same middlewares, same command
 * registry via PluginLoader, same pipeline. Only the transport layer is fake.
 *
 * The boot is unique per test process: Client/PluginLoader/commandRegistry
 * are module singletons and do not accept a second boot in the same process.
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ quiet: true });

// These variables must be set BEFORE the first import of '@/config'.
process.env.DB_TYPE = 'json';
process.env.PANEL_DISABLED = 'true';
process.env.LOG_LEVEL = 'error';
process.env.SESSION_PATH = './orbitsession';

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, vi } from 'vitest';
import { FakeWASocket } from './FakeWASocket.js';

vi.mock('@/core/WASocketFactory', () => ({
  FORCED_WA_VERSION: [2, 3000, 1043984129] as [number, number, number],
  SILENT_WA_LOGGER: { child: () => ({}) },
  WA_BROWSER_QR: ['OrbitBot', 'Chrome', '131.0.6778.0'] as [string, string, string],
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

// The bot calls process.send('ready') on connect (the supervisor protocol
// of orbit.ts). In the vitest worker that IPC channel belongs to tinypool:
// writing to it corrupts the protocol and kills the worker. The e2e has no
// supervisor, so the channel is disabled.
delete process.send;

/**
 * Boots the real bot (Client.initialize) against the FakeWASocket and emits
 * connection update open, as Baileys would on completing the handshake:
 * the pipeline sets mainBotId and the boot timestamp (echo filter).
 */
export async function bootBot(): Promise<BootState> {
  if (bootState) return bootState;

  tempDir = mkdtempSync(join(tmpdir(), 'orbit-e2e-'));
  process.chdir(tempDir);

  // Simulated session: the health check requires creds.json inside SESSION_PATH
  // and AuthManager would use this directory if the real socket existed.
  mkdirSync(join(tempDir, 'orbitsession'), { recursive: true });
  writeFileSync(
    join(tempDir, 'orbitsession', 'creds.json'),
    JSON.stringify({ noiseKey: {}, signedIdentityKey: {}, registrationId: 1 }),
  );

  // Same as index.ts: the repository manager (sql.js) before the client.
  const { initializeDatabase, getDbManager } = await import('@/repositories/Database.js');
  await initializeDatabase();

  const { WhatsAppClient } = await import('@/core/Client.js');
  const client = new WhatsAppClient();
  await client.initialize();

  const socket = client.getSocket() as unknown as FakeWASocket;

  // Handshake complete: powers AuthManager's ping/health-check and
  // registers mainBotId + the startup timestamp in the pipeline.
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
        // best-effort: the temp directory may stay locked
      }
      tempDir = null;
    }
  });

  return bootState;
}
