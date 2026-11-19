/**
 * AuthManager.test.ts
 *
 * Unit tests for the WhatsApp auth lifecycle (AuthManager) and the shared
 * reconnection policy (WADisconnectPolicy): disconnect classification,
 * backoff math, session cleanup, connection.close handling (strike
 * counters, 515 retry budget, exponential backoff scheduling), health
 * check, ping and shutdown.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { WASocket, ConnectionState } from 'baileys';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// --- Hoisted mock state (referenced inside vi.mock factories) ---------------

interface MockSock {
  ev: { on: ReturnType<typeof vi.fn> };
  ws: { close: ReturnType<typeof vi.fn>; readyState: number };
  user: { id: string; name: string } | undefined;
  authState: { creds: { registered: boolean } };
  sendPresenceUpdate: ReturnType<typeof vi.fn>;
  requestPairingCode: ReturnType<typeof vi.fn>;
  __emit(event: string, payload: unknown): void;
}

const {
  mockUseMultiFileAuthState,
  mockDisplayQR,
  mockDisplayPairingCode,
  mockValidatePhoneNumber,
  mockClearSessionFiles,
  mockConfig,
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
      },
      ws: { close: vi.fn(async () => {}), readyState: 1 },
      user: { id: '5215512345678:1@s.whatsapp.net', name: 'TestUser' },
      authState: { creds: { registered } },
      sendPresenceUpdate: vi.fn(async () => {}),
      requestPairingCode: vi.fn(async () => 'ABCD-1234'),
      __emit(event: string, payload: unknown) {
        for (const cb of handlers.get(event) ?? []) cb(payload);
      },
    };
    return sock;
  };

  return {
    mockUseMultiFileAuthState: vi.fn(),
    mockDisplayQR: vi.fn(),
    mockDisplayPairingCode: vi.fn(),
    mockValidatePhoneNumber: vi.fn((phone: string) => phone),
    mockClearSessionFiles: vi.fn(() => 0),
    mockConfig: {
      sessionPath: '/tmp/orbit-auth-test-session',
      auth: {
        usePairingCode: false,
        phoneNumber: undefined as string | undefined,
      },
    },
    createdSockets: [] as MockSock[],
    makeMockSock,
  };
});

// --- Module mocks -----------------------------------------------------------

vi.mock('baileys', async importOriginal => {
  const actual = await importOriginal<typeof import('baileys')>();
  return {
    ...actual,
    useMultiFileAuthState: (...args: unknown[]) => mockUseMultiFileAuthState(...args),
  };
});

vi.mock('../../src/config/index.js', () => ({ config: mockConfig }));

vi.mock('../../src/utils/qr.js', () => ({
  displayQR: (...args: unknown[]) => mockDisplayQR(...args),
  displayPairingCode: (...args: unknown[]) => mockDisplayPairingCode(...args),
  validatePhoneNumber: (...args: unknown[]) => mockValidatePhoneNumber(...args),
}));

// Real policy math is under test; only session cleanup is mocked for
// observation (its real implementation is exercised separately via
// vi.importActual against a temp directory).
vi.mock('../../src/core/WADisconnectPolicy.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/core/WADisconnectPolicy.js')>();
  return {
    ...actual,
    clearSessionFiles: (...args: unknown[]) => mockClearSessionFiles(...args),
  };
});

vi.mock('../../src/core/WASocketFactory.js', () => ({
  getWAVersion: () => [2, 3000, 1015901307],
  buildWASocketOptions: (opts: unknown) => opts,
  createCacheableKeyStore: (keys: unknown) => keys,
  WA_BROWSER_PAIRING: ['WhatsApp', 'Chrome', '10.15.3'],
  WA_BROWSER_QR: ['OrbitBot', 'Chrome', '10.15.3'],
  createWASocket: (opts?: { auth?: { creds?: { registered?: boolean } } }) => {
    // The mock socket inherits the registration flag from the auth state
    // AuthManager passes it (same as Baileys' real createWASocket does)
    const registered = Boolean(opts?.auth?.creds?.registered);
    const sock = makeMockSock(registered);
    createdSockets.push(sock);
    return sock;
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logError: vi.fn(),
}));

// --- Imports under test (after mocks) ---------------------------------------

import { AuthManager } from '../../src/core/AuthManager.js';
import {
  classifyDisconnect,
  extractDisconnectInfo,
  computeReconnectDelayMs,
  nextBackoff,
} from '../../src/core/WADisconnectPolicy.js';
import { DisconnectReason } from 'baileys';

// AuthManager calls process.send('ready') on connect; inside the vitest
// worker that corrupts the runner's IPC channel. Neutralized for the run.
const originalProcessSend = process.send;
process.send = undefined;
afterAll(() => {
  (process as { send: typeof originalProcessSend }).send = originalProcessSend;
});

// --- Helpers ---------------------------------------------------------------

function emitConnection(sock: MockSock, update: Partial<ConnectionState>): void {
  sock.__emit('connection.update', update);
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

// --- Tests -----------------------------------------------------------------

describe('WADisconnectPolicy (shared reconnection policy)', () => {
  describe('extractDisconnectInfo', () => {
    it('extracts statusCode and message from the Baileys payload', () => {
      const info = extractDisconnectInfo({
        error: { output: { statusCode: 515 }, message: 'restart required' },
      });
      expect(info).toEqual({ statusCode: 515, message: 'restart required' });
    });

    it('returns empty when there is no error', () => {
      expect(extractDisconnectInfo(undefined)).toEqual({});
      expect(extractDisconnectInfo({})).toEqual({});
    });
  });

  describe('classifyDisconnect', () => {
    it('classifies the main semantic codes', () => {
      expect(classifyDisconnect(DisconnectReason.connectionReplaced)).toBe('conflict');
      expect(classifyDisconnect(440)).toBe('conflict');
      expect(classifyDisconnect(DisconnectReason.loggedOut)).toBe('loggedOut');
      expect(classifyDisconnect(DisconnectReason.restartRequired)).toBe('restartRequired');
      expect(classifyDisconnect(515)).toBe('restartRequired');
      expect(classifyDisconnect(DisconnectReason.timedOut)).toBe('timedOut');
      // In this Baileys version connectionLost == 408 (same code as
      // timedOut), so classifyDisconnect reports it as timedOut
      expect(classifyDisconnect(DisconnectReason.connectionLost)).toBe('timedOut');
      expect(classifyDisconnect(DisconnectReason.connectionClosed)).toBe('network');
      expect(classifyDisconnect(502)).toBe('network');
      expect(classifyDisconnect(503)).toBe('network');
      expect(classifyDisconnect(DisconnectReason.badSession)).toBe('badSession');
    });

    it('classifies unknown and undefined codes as unknown', () => {
      expect(classifyDisconnect(undefined)).toBe('unknown');
      expect(classifyDisconnect(999)).toBe('unknown');
    });
  });

  describe('backoff', () => {
    it('computeReconnectDelayMs crece exponencialmente (factor 1.5)', () => {
      const base = 1000;
      const max = 300_000;
      expect(computeReconnectDelayMs(1, base, max)).toBe(1000);
      expect(computeReconnectDelayMs(2, base, max)).toBe(1500);
      expect(computeReconnectDelayMs(3, base, max)).toBe(2250);
      expect(computeReconnectDelayMs(4, base, max)).toBe(3375);
    });

    it('computeReconnectDelayMs clamps to maxDelayMs and tolerates attempt <= 0', () => {
      const base = 1000;
      const max = 5000;
      expect(computeReconnectDelayMs(1, base, max)).toBe(1000);
      expect(computeReconnectDelayMs(50, base, max)).toBe(5000);
      expect(computeReconnectDelayMs(0, base, max)).toBe(1000);
    });

    it('nextBackoff scales from the current delay and clamps to the maximum', () => {
      expect(nextBackoff(1000, 300_000)).toBe(1500);
      expect(nextBackoff(1500, 300_000)).toBe(2250);
      expect(nextBackoff(4000, 5000)).toBe(5000);
    });
  });

  describe('socketTransportState', () => {
    it('reads readyState/hasUser from the socket', async () => {
      const { socketTransportState } = await import('../../src/core/WADisconnectPolicy.js');
      expect(socketTransportState(null)).toEqual({ readyState: undefined, hasUser: false });
      const sock = makeMockSock();
      expect(socketTransportState(sock)).toEqual({ readyState: 1, hasUser: true });
      sock.ws.readyState = 3;
      sock.user = undefined;
      expect(socketTransportState(sock)).toEqual({ readyState: 3, hasUser: false });
    });
  });

  describe('clearSessionFiles (real implementation)', () => {
    it('deletes every file in the directory and returns the count', async () => {
      const { clearSessionFiles } = await vi.importActual<
        typeof import('../../src/core/WADisconnectPolicy.js')
      >('../../src/core/WADisconnectPolicy.js');

      const dir = mkdtempSync(join(tmpdir(), 'orbit-session-'));
      try {
        writeFileSync(join(dir, 'creds.json'), '{}');
        writeFileSync(join(dir, 'session-1.json'), '{}');
        writeFileSync(join(dir, 'app-state.json'), '{}');

        expect(clearSessionFiles(dir)).toBe(3);
        expect(readdirSync(dir)).toEqual([]);
        // Existing but empty directory
        expect(clearSessionFiles(dir)).toBe(0);
        // Nonexistent directory
        expect(clearSessionFiles(join(dir, 'no-existe'))).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('AuthManager', () => {
  let auth: AuthManager;
  let tempSessionDir: string;
  let recreateMock: ReturnType<typeof vi.fn>;

  const makeAuth = (): AuthManager => {
    auth = new AuthManager();
    return auth;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    tempSessionDir = mkdtempSync(join(tmpdir(), 'orbit-auth-session-'));
    mockConfig.sessionPath = tempSessionDir;
    mockConfig.auth.usePairingCode = false;
    mockConfig.auth.phoneNumber = undefined;
    mockUseMultiFileAuthState.mockResolvedValue({
      state: { creds: { registered: false, me: undefined } },
      saveCreds: vi.fn(async () => {}),
    });
    recreateMock = vi.fn(async (_oldSock: WASocket) => makeMockSock(true));
  });

  afterEach(async () => {
    await auth?.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
    createdSockets.length = 0;
    if (tempSessionDir && existsSync(tempSessionDir)) {
      rmSync(tempSessionDir, { recursive: true, force: true });
    }
  });

  it('starts disconnected with no socket', () => {
    const manager = makeAuth();
    expect(manager.isConnected()).toBe(false);
    expect(manager.getCurrentSocket()).toBeNull();
  });

  it('createSocket creates the socket, subscribes to events and exposes it', async () => {
    const manager = makeAuth();
    const sock = await manager.createSocket();

    expect(createdSockets).toContain(sock);
    expect(manager.getCurrentSocket()).toBe(sock);
    expect(sock.ev.on).toHaveBeenCalledWith('creds.update', expect.any(Function));
    expect(sock.ev.on).toHaveBeenCalledWith('connection.update', expect.any(Function));
    expect(mockUseMultiFileAuthState).toHaveBeenCalledWith(tempSessionDir);
  });

  it('connection=open marks connected and starts ping and health check', async () => {
    const manager = makeAuth();
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();

    expect(manager.isConnected()).toBe(true);

    // Ping every 15s
    await vi.advanceTimersByTimeAsync(15_000);
    expect(sock.sendPresenceUpdate).toHaveBeenCalledWith('available', 'status@broadcast');

    // Health check: live socket (readyState 1 + user) → stays connected
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.isConnected()).toBe(true);
  });

  it('connection=close from a network error schedules reconnection via callback', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();
    expect(manager.isConnected()).toBe(true);

    emitConnection(sock, {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 503 } } },
    });
    await flush();
    expect(manager.isConnected()).toBe(false);

    // First attempt: 1s initial delay
    await vi.advanceTimersByTimeAsync(999);
    expect(recreateMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(recreateMock).toHaveBeenCalledTimes(1);
    expect(recreateMock).toHaveBeenCalledWith(sock);
    expect(manager.getCurrentSocket()).not.toBe(sock);
  });

  it('scales exponential backoff across successive reconnections (1s, 1.5s, 2.25s)', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();

    const close = () =>
      emitConnection(sock, {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 503 } } },
      });

    close();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).toHaveBeenCalledTimes(1);

    close();
    await flush();
    await vi.advanceTimersByTimeAsync(1499);
    expect(recreateMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(recreateMock).toHaveBeenCalledTimes(2);

    close();
    await flush();
    await vi.advanceTimersByTimeAsync(2249);
    expect(recreateMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(recreateMock).toHaveBeenCalledTimes(3);
  });

  it('error 515 waits 3s before reconnecting (own budget)', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();

    emitConnection(sock, {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 515 } } },
    });
    await flush();

    // At 1s and 3s there was still no attempt (the 515 wait is 3s and then
    // the scheduled reconnection uses its own 1s delay)
    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(recreateMock).not.toHaveBeenCalled();

    // 3s (515 wait) + 1s (reconnect delay) = 4s
    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).toHaveBeenCalledTimes(1);
  });

  it('logged out from the phone (401): 3 strikes clear the session', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();

    const close401 = () =>
      emitConnection(sock, {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 401 } } },
      });

    close401();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);

    close401();
    await flush();
    await vi.advanceTimersByTimeAsync(1500);

    expect(mockClearSessionFiles).not.toHaveBeenCalled();

    close401();
    await flush();
    expect(mockClearSessionFiles).toHaveBeenCalledTimes(1);
    expect(mockClearSessionFiles).toHaveBeenCalledWith(tempSessionDir, '[AuthManager]');
    expect(manager.isConnected()).toBe(false);
  });

  it('corrupt session (badSession) accrues separate strikes and clears on the third', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();

    const closeBad = () =>
      emitConnection(sock, {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: DisconnectReason.badSession } } },
      });

    closeBad();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    closeBad();
    await flush();
    await vi.advanceTimersByTimeAsync(1500);
    expect(mockClearSessionFiles).not.toHaveBeenCalled();

    closeBad();
    await flush();
    expect(mockClearSessionFiles).toHaveBeenCalledTimes(1);
  });

  it('health check detects the dead socket and forces reconnection', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();
    expect(manager.isConnected()).toBe(true);

    // The socket stays half-open/closed with no close event
    sock.ws.readyState = 3;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.isConnected()).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).toHaveBeenCalledTimes(1);
  });

  it('when socket recreation fails, it retries on the next cycle', async () => {
    const manager = makeAuth();
    const failingRecreate = vi.fn(async () => {
      throw new Error('boom');
    });
    manager.setOnSocketRecreate(failingRecreate);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();
    emitConnection(sock, {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 428 } } },
    });
    await flush();

    await vi.advanceTimersByTimeAsync(1000);
    expect(failingRecreate).toHaveBeenCalledTimes(1);

    // The failure re-schedules the reconnection with backoff (1.5s)
    await vi.advanceTimersByTimeAsync(1500);
    expect(failingRecreate).toHaveBeenCalledTimes(2);
  });

  it('QR is shown up to MAX_QR_RETRIES and then clears the session and reconnects', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    for (let i = 0; i < 10; i++) {
      emitConnection(sock, { qr: `qr-payload-${i}` });
      await flush();
    }
    expect(mockDisplayQR).toHaveBeenCalledTimes(10);
    expect(mockClearSessionFiles).not.toHaveBeenCalled();

    // QR #11: too many attempts → reset + reconnect
    emitConnection(sock, { qr: 'qr-payload-11' });
    await flush();
    expect(mockDisplayQR).toHaveBeenCalledTimes(10);
    expect(mockClearSessionFiles).toHaveBeenCalledWith(tempSessionDir, '[AuthManager]');
  });

  it('refresh QR is ignored when the session is already registered', async () => {
    mockUseMultiFileAuthState.mockResolvedValue({
      state: { creds: { registered: true, me: { id: 'x:1@s.whatsapp.net', name: 'Bot' } } },
      saveCreds: vi.fn(async () => {}),
    });
    const manager = makeAuth();
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { qr: 'refresh-qr' });
    await flush();

    expect(mockDisplayQR).not.toHaveBeenCalled();
    expect(mockClearSessionFiles).not.toHaveBeenCalled();
  });

  it('pairing code mode requests and shows the pairing code', async () => {
    mockConfig.auth.usePairingCode = true;
    mockConfig.auth.phoneNumber = '+52 1 55 1234 5678';

    const manager = makeAuth();
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { qr: 'ignored-in-pairing-mode' });
    await flush();

    expect(mockDisplayQR).not.toHaveBeenCalled();
    expect(sock.requestPairingCode).toHaveBeenCalledWith('5215512345678');
    expect(mockDisplayPairingCode).toHaveBeenCalledWith('ABCD-1234');
  });

  it('transient pairing code failure (timeout) reschedules the reconnection', async () => {
    mockConfig.auth.usePairingCode = true;
    mockConfig.auth.phoneNumber = '+5215512345678';

    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;
    sock.requestPairingCode.mockRejectedValue(new Error('Connection Closed'));

    emitConnection(sock, { qr: 'trigger' });
    await flush();
    expect(sock.requestPairingCode).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).toHaveBeenCalledTimes(1);
  });

  it('shutdown closes the socket, clears state and stops pinging', async () => {
    const manager = makeAuth();
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();
    expect(manager.isConnected()).toBe(true);

    await manager.shutdown();

    expect(sock.ws.close).toHaveBeenCalled();
    expect(manager.getCurrentSocket()).toBeNull();
    expect(manager.isConnected()).toBe(false);

    const pingCalls = sock.sendPresenceUpdate.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sock.sendPresenceUpdate.mock.calls.length).toBe(pingCalls);
  });
});
