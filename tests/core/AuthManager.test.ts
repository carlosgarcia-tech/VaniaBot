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
      sessionPath: '/tmp/vaniabot-auth-test-session',
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
  WA_BROWSER_QR: ['VaniaBot', 'Chrome', '10.15.3'],
  createWASocket: (opts?: { auth?: { creds?: { registered?: boolean } } }) => {
    // El socket mock hereda el flag de registro del auth state que AuthManager
    // le pasa (igual que hace el createWASocket real de Baileys)
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

// AuthManager llama process.send('ready') al conectar; dentro del worker de
// vitest eso corrompe el canal IPC del runner. Se neutraliza durante el run.
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

describe('WADisconnectPolicy (política de reconexión compartida)', () => {
  describe('extractDisconnectInfo', () => {
    it('extrae statusCode y message del payload de Baileys', () => {
      const info = extractDisconnectInfo({
        error: { output: { statusCode: 515 }, message: 'restart required' },
      });
      expect(info).toEqual({ statusCode: 515, message: 'restart required' });
    });

    it('devuelve vacío cuando no hay error', () => {
      expect(extractDisconnectInfo(undefined)).toEqual({});
      expect(extractDisconnectInfo({})).toEqual({});
    });
  });

  describe('classifyDisconnect', () => {
    it('clasifica los códigos semánticos principales', () => {
      expect(classifyDisconnect(DisconnectReason.connectionReplaced)).toBe('conflict');
      expect(classifyDisconnect(440)).toBe('conflict');
      expect(classifyDisconnect(DisconnectReason.loggedOut)).toBe('loggedOut');
      expect(classifyDisconnect(DisconnectReason.restartRequired)).toBe('restartRequired');
      expect(classifyDisconnect(515)).toBe('restartRequired');
      expect(classifyDisconnect(DisconnectReason.timedOut)).toBe('timedOut');
      // En esta versión de Baileys connectionLost == 408 (mismo código que
      // timedOut), así que classifyDisconnect lo reporta como timedOut
      expect(classifyDisconnect(DisconnectReason.connectionLost)).toBe('timedOut');
      expect(classifyDisconnect(DisconnectReason.connectionClosed)).toBe('network');
      expect(classifyDisconnect(502)).toBe('network');
      expect(classifyDisconnect(503)).toBe('network');
      expect(classifyDisconnect(DisconnectReason.badSession)).toBe('badSession');
    });

    it('clasifica códigos desconocidos y undefined como unknown', () => {
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

    it('computeReconnectDelayMs acota en maxDelayMs y tolera attempt <= 0', () => {
      const base = 1000;
      const max = 5000;
      expect(computeReconnectDelayMs(1, base, max)).toBe(1000);
      expect(computeReconnectDelayMs(50, base, max)).toBe(5000);
      expect(computeReconnectDelayMs(0, base, max)).toBe(1000);
    });

    it('nextBackoff escala desde el delay actual y acota en el máximo', () => {
      expect(nextBackoff(1000, 300_000)).toBe(1500);
      expect(nextBackoff(1500, 300_000)).toBe(2250);
      expect(nextBackoff(4000, 5000)).toBe(5000);
    });
  });

  describe('socketTransportState', () => {
    it('lee readyState/hasUser del socket', async () => {
      const { socketTransportState } = await import('../../src/core/WADisconnectPolicy.js');
      expect(socketTransportState(null)).toEqual({ readyState: undefined, hasUser: false });
      const sock = makeMockSock();
      expect(socketTransportState(sock)).toEqual({ readyState: 1, hasUser: true });
      sock.ws.readyState = 3;
      sock.user = undefined;
      expect(socketTransportState(sock)).toEqual({ readyState: 3, hasUser: false });
    });
  });

  describe('clearSessionFiles (implementación real)', () => {
    it('borra todos los archivos del directorio y devuelve el conteo', async () => {
      const { clearSessionFiles } = await vi.importActual<
        typeof import('../../src/core/WADisconnectPolicy.js')
      >('../../src/core/WADisconnectPolicy.js');

      const dir = mkdtempSync(join(tmpdir(), 'vania-session-'));
      try {
        writeFileSync(join(dir, 'creds.json'), '{}');
        writeFileSync(join(dir, 'session-1.json'), '{}');
        writeFileSync(join(dir, 'app-state.json'), '{}');

        expect(clearSessionFiles(dir)).toBe(3);
        expect(readdirSync(dir)).toEqual([]);
        // Directorio existente pero vacío
        expect(clearSessionFiles(dir)).toBe(0);
        // Directorio inexistente
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
    tempSessionDir = mkdtempSync(join(tmpdir(), 'vania-auth-session-'));
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

  it('arranca desconectado y sin socket', () => {
    const manager = makeAuth();
    expect(manager.isConnected()).toBe(false);
    expect(manager.getCurrentSocket()).toBeNull();
  });

  it('createSocket crea el socket, se suscribe a eventos y lo expone', async () => {
    const manager = makeAuth();
    const sock = await manager.createSocket();

    expect(createdSockets).toContain(sock);
    expect(manager.getCurrentSocket()).toBe(sock);
    expect(sock.ev.on).toHaveBeenCalledWith('creds.update', expect.any(Function));
    expect(sock.ev.on).toHaveBeenCalledWith('connection.update', expect.any(Function));
    expect(mockUseMultiFileAuthState).toHaveBeenCalledWith(tempSessionDir);
  });

  it('connection=open marca conectado e inicia ping y health check', async () => {
    const manager = makeAuth();
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();

    expect(manager.isConnected()).toBe(true);

    // Ping cada 15s
    await vi.advanceTimersByTimeAsync(15_000);
    expect(sock.sendPresenceUpdate).toHaveBeenCalledWith('available', 'status@broadcast');

    // Health check: socket vivo (readyState 1 + user) → sigue conectado
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.isConnected()).toBe(true);
  });

  it('connection=close por error de red programa la reconexión vía callback', async () => {
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

    // Primer intento: delay inicial de 1s
    await vi.advanceTimersByTimeAsync(999);
    expect(recreateMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(recreateMock).toHaveBeenCalledTimes(1);
    expect(recreateMock).toHaveBeenCalledWith(sock);
    expect(manager.getCurrentSocket()).not.toBe(sock);
  });

  it('escala el backoff exponencial entre reconexiones sucesivas (1s, 1.5s, 2.25s)', async () => {
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

  it('error 515 espera 3s antes de reconectar (budget propio)', async () => {
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

    // A los 1s y 3s todavía no hubo intento (la espera del 515 es de 3s y
    // luego la reconexión agendada usa su propio delay de 1s)
    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(recreateMock).not.toHaveBeenCalled();

    // 3s (espera del 515) + 1s (delay de reconexión) = 4s
    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).toHaveBeenCalledTimes(1);
  });

  it('cierra de sesión desde el teléfono (401): 3 strikes limpian la sesión', async () => {
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

  it('sesión corrupta (badSession) acumula strikes por separado y limpia al tercero', async () => {
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

  it('health check detecta el socket muerto y fuerza la reconexión', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    emitConnection(sock, { connection: 'open' });
    await flush();
    expect(manager.isConnected()).toBe(true);

    // El socket se queda half-open/closed sin evento close
    sock.ws.readyState = 3;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.isConnected()).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(recreateMock).toHaveBeenCalledTimes(1);
  });

  it('si falla la recreación del socket, reintenta en el siguiente ciclo', async () => {
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

    // El fallo reagenda la reconexión con backoff (1.5s)
    await vi.advanceTimersByTimeAsync(1500);
    expect(failingRecreate).toHaveBeenCalledTimes(2);
  });

  it('QR se muestra hasta MAX_QR_RETRIES y luego limpia sesión y reconecta', async () => {
    const manager = makeAuth();
    manager.setOnSocketRecreate(recreateMock);
    const sock = (await manager.createSocket()) as unknown as MockSock;

    for (let i = 0; i < 10; i++) {
      emitConnection(sock, { qr: `qr-payload-${i}` });
      await flush();
    }
    expect(mockDisplayQR).toHaveBeenCalledTimes(10);
    expect(mockClearSessionFiles).not.toHaveBeenCalled();

    // QR #11: demasiados intentos → limpiar + reconectar
    emitConnection(sock, { qr: 'qr-payload-11' });
    await flush();
    expect(mockDisplayQR).toHaveBeenCalledTimes(10);
    expect(mockClearSessionFiles).toHaveBeenCalledWith(tempSessionDir, '[AuthManager]');
  });

  it('QR de refresh se ignora cuando la sesión ya está registrada', async () => {
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

  it('modo pairing code solicita y muestra el código de pareamiento', async () => {
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

  it('fallo transitorio del pairing code (timeout) reagenda la reconexión', async () => {
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

  it('shutdown cierra el socket, limpia estado y deja de pinguear', async () => {
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
