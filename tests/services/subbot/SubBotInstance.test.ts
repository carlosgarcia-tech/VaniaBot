/**
 * SubBotInstance.test.ts
 *
 * Unit tests for an individual subbot connection lifecycle: session start
 * (new vs existing), pairing code request/format/retry, disconnect handling
 * (440 conflict with fixed delay, 401 double-strike session invalidation,
 * 500 badSession without cleanup, 515/network backoff), the one-shot 'ready'
 * latch, message filtering, group cache invalidation, health check with
 * confirmation wait, ping loop, start failure recovery and stop().
 *
 * Real implementations are used for WADisconnectPolicy (classification +
 * backoff math) and clearSessionFiles (against a temp directory).
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WASocket, ConnectionState } from 'baileys';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { SubBotConfig } from '../../../src/types/subbot.js';

// --- Hoisted mock state -----------------------------------------------------

interface MockSock {
  ev: {
    on: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
  };
  ws: { close: ReturnType<typeof vi.fn>; readyState: number };
  user: { id: string; name: string } | undefined;
  authState: { creds: { registered: boolean } };
  sendPresenceUpdate: ReturnType<typeof vi.fn>;
  requestPairingCode: ReturnType<typeof vi.fn>;
  __emit(event: string, payload: unknown): void;
}

const {
  mockUseEncrypted,
  mockDbUpdate,
  mockInvalidateGroupMetadata,
  mockSetStartupTimestamp,
  createdSockets,
  makeMockSock,
} = vi.hoisted(() => {
  const makeMockSock = (registered = false): MockSock => {
    const handlers = new Map<string, ((payload: unknown) => unknown)[]>();
    const sock: MockSock = {
      ev: {
        on: vi.fn((event: string, cb: (payload: unknown) => unknown) => {
          const list = handlers.get(event) ?? [];
          list.push(cb);
          handlers.set(event, list);
        }),
        removeAllListeners: vi.fn((event: string) => {
          handlers.delete(event);
        }),
      },
      ws: { close: vi.fn(async () => {}), readyState: 1 },
      user: { id: '5215599998888:1@s.whatsapp.net', name: 'SubBot' },
      authState: { creds: { registered } },
      sendPresenceUpdate: vi.fn(async () => {}),
      requestPairingCode: vi.fn(async () => 'ABCD1234'),
      __emit(event: string, payload: unknown) {
        for (const cb of handlers.get(event) ?? []) cb(payload);
      },
    };
    return sock;
  };

  return {
    mockUseEncrypted: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockInvalidateGroupMetadata: vi.fn(),
    mockSetStartupTimestamp: vi.fn(),
    createdSockets: [] as MockSock[],
    makeMockSock,
  };
});

// --- Module mocks -----------------------------------------------------------

vi.mock('../../../src/core/WASocketFactory.js', () => ({
  getWAVersion: () => [2, 3000, 1015901307],
  buildWASocketOptions: (opts: unknown) => opts,
  createCacheableKeyStore: (keys: unknown) => keys,
  WA_BROWSER_PAIRING: ['WhatsApp', 'Chrome', '10.15.3'],
  createWASocket: (opts?: { auth?: { creds?: { registered?: boolean } } }) => {
    const sock = makeMockSock(Boolean(opts?.auth?.creds?.registered));
    createdSockets.push(sock);
    return sock;
  },
}));

vi.mock('../../../src/services/subbot/EncryptedAuthState.js', () => ({
  useEncryptedMultiFileAuthState: (...args: unknown[]) => mockUseEncrypted(...args),
}));

vi.mock('../../../src/services/subbot/SubBotDatabase.js', () => ({
  subBotDatabase: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    save: vi.fn(),
    get: vi.fn(),
    getSlot: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/RuntimeStateRepository.js', () => ({
  runtimeStateRepository: { setStartupTimestamp: (...args: unknown[]) => mockSetStartupTimestamp(...args) },
}));

vi.mock('../../../src/core/CacheManager.js', () => ({
  cacheManager: { invalidateGroupMetadata: (...args: unknown[]) => mockInvalidateGroupMetadata(...args) },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logError: vi.fn(),
}));

// --- Imports under test (after mocks) ---------------------------------------

import { SubBotInstance } from '../../../src/services/subbot/SubBotInstance.js';
import { DisconnectReason } from 'baileys';

// --- Helpers ---------------------------------------------------------------

function makeConfig(sessionPath: string, registered = false): SubBotConfig {
  return {
    id: 'testbot1',
    ownerJid: '5215511112222@s.whatsapp.net',
    ownerName: 'Owner',
    phoneNumber: '5215599998888',
    sessionPath,
    prefix: '!',
    name: 'OrbitBot-Test',
    active: true,
    createdAt: Date.now(),
    status: registered ? 'connected' : 'connecting',
    slot: 1,
    label: 'slot1',
  };
}

function emitConnection(sock: MockSock, update: Partial<ConnectionState>): void {
  sock.__emit('connection.update', update);
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

const lastDbStatus = (): unknown => mockDbUpdate.mock.calls.at(-1)?.[1];

// --- Tests -----------------------------------------------------------------

describe('SubBotInstance', () => {
  let instance: SubBotInstance;
  let tempSessionDir: string;
  let statusEvents: string[];
  let readyEvents: number;
  let sessionInvalidEvents: number;

  const makeInstance = (registered = false): SubBotInstance => {
    instance = new SubBotInstance(makeConfig(tempSessionDir, registered));
    statusEvents = [];
    readyEvents = 0;
    sessionInvalidEvents = 0;
    instance.on('status', (s: string) => statusEvents.push(s));
    instance.on('ready', () => readyEvents++);
    instance.on('sessionInvalid', () => sessionInvalidEvents++);
    return instance;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    tempSessionDir = mkdtempSync(join(tmpdir(), 'orbit-subbot-session-'));
    createdSockets.length = 0;
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: false } },
      saveCreds: vi.fn(async () => {}),
    });
  });

  afterEach(async () => {
    await instance?.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
    createdSockets.length = 0;
    if (tempSessionDir && existsSync(tempSessionDir)) {
      rmSync(tempSessionDir, { recursive: true, force: true });
    }
  });

  it('new session: emits connecting, requests the pairing code at 8s and formats it', async () => {
    makeInstance(false);
    await instance.start();
    await flush();

    expect(statusEvents).toContain('connecting');
    expect(mockDbUpdate).toHaveBeenCalledWith('testbot1', { status: 'connecting' });
    expect(createdSockets).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(8_000);

    expect(createdSockets[0].requestPairingCode).toHaveBeenCalledWith('5215599998888');
    expect(mockDbUpdate).toHaveBeenCalledWith(
      'testbot1',
      expect.objectContaining({ pairingCode: 'ABCD-1234' }),
    );
  });

  it('existing session: does not request a pairing code', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    await flush();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(createdSockets[0].requestPairingCode).not.toHaveBeenCalled();
  });

  it('pairing code fails with Connection Closed and retries at 5s', async () => {
    makeInstance(false);
    const sock = createdSockets.length ? undefined : undefined; // populated on start
    void sock;
    await instance.start();
    createdSockets[0].requestPairingCode
      .mockRejectedValueOnce(new Error('Connection Closed'))
      .mockResolvedValueOnce('EFGH5678');

    await vi.advanceTimersByTimeAsync(8_000);
    expect(createdSockets[0].requestPairingCode).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(createdSockets[0].requestPairingCode).toHaveBeenCalledTimes(2);
    expect(mockDbUpdate).toHaveBeenCalledWith(
      'testbot1',
      expect.objectContaining({ pairingCode: 'EFGH-5678' }),
    );
  });

  it('connection=open connects: status connected, ready only once and ping every 30s', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    const sock = createdSockets[0];

    emitConnection(sock, { connection: 'open' });
    await flush();

    expect(readyEvents).toBe(1);
    expect(statusEvents).toContain('connected');
    expect(mockDbUpdate).toHaveBeenCalledWith(
      'testbot1',
      expect.objectContaining({ status: 'connected', active: true }),
    );
    expect(mockSetStartupTimestamp).toHaveBeenCalledWith('testbot1');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(sock.sendPresenceUpdate).toHaveBeenCalledWith('available', 'status@broadcast');

    // Second open (no close in between): ready still 1
    emitConnection(sock, { connection: 'open' });
    await flush();
    expect(readyEvents).toBe(1);
  });

  it('creds.update with a registered session also triggers the full connection', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();

    createdSockets[0].__emit('creds.update', undefined);
    await flush();

    expect(readyEvents).toBe(1);
    expect(statusEvents).toContain('connected');
  });

  it('515/network: reconnects with the 15s base delay', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    emitConnection(createdSockets[0], { connection: 'open' });
    await flush();

    emitConnection(createdSockets[0], {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 515 } } },
    });
    await flush();

    await vi.advanceTimersByTimeAsync(14_999);
    expect(createdSockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createdSockets).toHaveLength(2);
  });

  it('440 conflict: closes the old socket immediately and reconnects at a fixed 20s', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    const oldSock = createdSockets[0];
    emitConnection(oldSock, { connection: 'open' });
    await flush();

    emitConnection(oldSock, {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: DisconnectReason.connectionReplaced } } },
    });
    await flush();

    expect(oldSock.ws.close).toHaveBeenCalled();
    expect(oldSock.ev.removeAllListeners).toHaveBeenCalledWith('connection.update');

    await vi.advanceTimersByTimeAsync(19_999);
    expect(createdSockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createdSockets).toHaveLength(2);
  });

  it('401: the first close retries; the second confirms revocation, clears the session and emits sessionInvalid', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    writeFileSync(join(tempSessionDir, 'creds.json'), '{}');

    emitConnection(createdSockets[0], { connection: 'open' });
    await flush();

    const close401 = (sock: MockSock) =>
      emitConnection(sock, {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: DisconnectReason.loggedOut } } },
      });

    close401(createdSockets[0]);
    await flush();
    expect(sessionInvalidEvents).toBe(0);
    expect(existsSync(join(tempSessionDir, 'creds.json'))).toBe(true);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(createdSockets).toHaveLength(2);

    close401(createdSockets[1]);
    await flush();
    expect(sessionInvalidEvents).toBe(1);
    expect(existsSync(join(tempSessionDir, 'creds.json'))).toBe(false);
  });

  it('badSession (500): reconnects without clearing the session', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    emitConnection(createdSockets[0], { connection: 'open' });
    await flush();
    writeFileSync(join(tempSessionDir, 'creds.json'), '{}');

    emitConnection(createdSockets[0], {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: DisconnectReason.badSession } } },
    });
    await flush();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(existsSync(join(tempSessionDir, 'creds.json'))).toBe(true);
    expect(createdSockets).toHaveLength(2);
  });

  it('messages.upsert: only notifies messages from others with content and type notify', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    const received: unknown[] = [];
    instance.on('message', msg => received.push(msg));

    const sock = createdSockets[0];
    const msg = { key: { id: 'm1', fromMe: false, remoteJid: 'g@g.us' }, message: {} };
    sock.__emit('messages.upsert', { messages: [msg], type: 'notify' });
    sock.__emit('messages.upsert', {
      messages: [{ key: { id: 'm2', fromMe: true }, message: {} }],
      type: 'notify',
    });
    sock.__emit('messages.upsert', {
      messages: [{ key: { id: 'm3', fromMe: false }, message: {} }],
      type: 'append',
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(msg);
  });

  it('groups.update invalidates the cached group metadata', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();

    createdSockets[0].__emit('groups.update', [{ id: 'grupo@g.us' }]);

    expect(mockInvalidateGroupMetadata).toHaveBeenCalledWith('grupo@g.us');
  });

  it('health check: a dead socket is confirmed at 60s and reconnects at 15s', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    const sock = createdSockets[0];
    emitConnection(sock, { connection: 'open' });
    await flush();

    sock.ws.readyState = 3;

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(createdSockets).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(lastDbStatus()).toEqual(expect.objectContaining({ status: 'connecting' }));

    await vi.advanceTimersByTimeAsync(15_000);
    expect(createdSockets).toHaveLength(2);
  });

  it('startup failure: marks error and retries successfully at 15s', async () => {
    mockUseEncrypted.mockRejectedValueOnce(new Error('disk full'));
    makeInstance(false);

    await instance.start();
    await flush();

    expect(mockDbUpdate).toHaveBeenCalledWith('testbot1', { status: 'error' });
    expect(statusEvents).toContain('error');
    expect(createdSockets).toHaveLength(0);

    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: false } },
      saveCreds: vi.fn(async () => {}),
    });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(createdSockets).toHaveLength(1);
  });

  it('stop(): destroys the instance, closes the socket and no longer reconnects or pings', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    const sock = createdSockets[0];
    emitConnection(sock, { connection: 'open' });
    await flush();

    await instance.stop();
    expect(sock.ws.close).toHaveBeenCalled();
    expect(mockDbUpdate).toHaveBeenCalledWith('testbot1', { status: 'disconnected' });
    expect(statusEvents).toContain('disconnected');

    const pings = sock.sendPresenceUpdate.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sock.sendPresenceUpdate.mock.calls.length).toBe(pings);

    // start() on a destroyed instance is a no-op
    await instance.start();
    expect(createdSockets).toHaveLength(1);
  });

  it('isConnected reflects the real socket state', async () => {
    mockUseEncrypted.mockResolvedValue({
      state: { creds: { registered: true } },
      saveCreds: vi.fn(async () => {}),
    });
    makeInstance(true);
    await instance.start();
    const sock = createdSockets[0];
    emitConnection(sock, { connection: 'open' });
    await flush();

    expect(instance.isConnected()).toBe(true);

    sock.ws.readyState = 3;
    expect(instance.isConnected()).toBe(false);
  });
});
