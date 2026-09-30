/**
 * SubBotManager.test.ts
 *
 * Unit tests for the subbot orchestration layer: slot lifecycle
 * (request/reserve/activate), instance launching with event wiring
 * (pairingCode → owner notification + reminder, ready → connected +
 * group preload, sessionInvalid → cleanup + notify, disconnected →
 * slot status), stop/delete/reconnect/reset flows, orphaned session
 * recovery, health check (reactivation, stale linking, stale pairing)
 * and shutdown.
 *
 * SubBotInstance is mocked so the tests exercise the manager's
 * orchestration: instance creation, event wiring, slot/database
 * transitions and owner notifications. SUBBOT_CONFIG paths are
 * redirected to temp directories for the fs-touching flows.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { WASocket } from 'baileys';
import type { SubBotConfig, SubBotSlot, SubBotSlotStatus } from '../../../src/types/subbot.js';

// --- Hoisted mock state (referenced inside vi.mock factories) ---------------

const {
  mockDb,
  mockMainSock,
  instances,
  lastInstance,
  mockGetGroup,
  MockInstanceCtor,
} = vi.hoisted(() => {
  class MockInstance {
    config: SubBotConfig;
    sock: WASocket | undefined;
    pairingCode: string | undefined;
    stopped = false;
    handlers = new Map<string, ((...args: unknown[]) => void)[]>();

    constructor(config: SubBotConfig) {
      this.config = config;
      this.sock = {
        user: { id: `${config.phoneNumber}:1@s.whatsapp.net` },
        groupFetchAllParticipating: async () => ({}),
      } as unknown as WASocket;
      instances.set(config.id, this);
    }

    on(event: string, cb: (...args: unknown[]) => void): this {
      const list = this.handlers.get(event) ?? [];
      list.push(cb);
      this.handlers.set(event, list);
      return this;
    }

    emitEvent(event: string, ...args: unknown[]): void {
      for (const cb of this.handlers.get(event) ?? []) cb(...args);
    }

    async start(): Promise<void> {}

    async stop(): Promise<void> {
      this.stopped = true;
    }
  }

  const instances = new Map<string, MockInstance>();
  const lastInstance = (): MockInstance | undefined => [...instances.values()].at(-1);

  const mockDb = {
    getActiveSlots: vi.fn((): SubBotSlot[] => []),
    getAllSlots: vi.fn((): SubBotSlot[] => []),
    getMaxSlots: vi.fn(() => 15),
    get: vi.fn(),
    getSlot: vi.fn(),
    getFreeSlot: vi.fn(),
    getOwnerSlots: vi.fn((): SubBotSlot[] => []),
    getOwnerSlotById: vi.fn(),
    isPublicRequestsEnabled: vi.fn(() => true),
    reserveSlot: vi.fn(() => true),
    activateSlot: vi.fn(),
    updateSlotStatus: vi.fn(),
    releaseSlot: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  };

  const mockMainSock = {
    sendMessage: vi.fn(async () => {}),
  };

  return {
    mockDb,
    mockMainSock,
    instances,
    lastInstance,
    mockGetGroup: vi.fn(async () => ({})),
    MockInstanceCtor: MockInstance,
  };
});

// --- Module mocks -----------------------------------------------------------

vi.mock('../../../src/config/subbot.js', () => ({
  SUBBOT_CONFIG: {
    MAX_SLOTS: 50,
    DEFAULT_SLOTS: 15,
    SESSION_BASE_PATH: '/tmp/vania-test-sessions-default',
    RUNTIME_STATE_DIR: '/tmp/vania-test-runtime-default',
    BOT_RUNTIME_STATE_TTL_MS: 120_000,
    MESSAGE_DEDUP_TTL_MS: 60_000,
    MESSAGE_DEDUP_MAX_ENTRIES: 4000,
    CONTACT_CACHE_TTL_MS: 600_000,
    CONTACT_CACHE_MAX_ENTRIES: 3000,
    PROFILE_APPLY_DELAY_MS: 15_000,
    HEALTH_CHECK_INTERVAL: 120_000,
    BOT_CONNECTING_STALE_MS: 300_000,
    BOT_PAIRING_STALE_MS: 300_000,
    SETTINGS_SYNC_INTERVAL_MS: 60_000,
    PAIRING_CODE_CACHE_MS: 60_000,
    PUBLIC_REQUESTS: true,
    SLOT_STAGGER_MS: 700,
    SLOT_STAGGER_MAX_MS: 8000,
    HEALTH_CHECK_CONFIRM_MS: 60_000,
    RUNTIME_STATE_WRITE_DEBOUNCE_MS: 5000,
  },
  SUBBOT_COMMAND_TIMEOUT_MS: 180_000,
  SUBBOT_DOWNLOAD_TIMEOUT_MS: 720_000,
}));

vi.mock('../../../src/services/subbot/SubBotInstance.js', () => ({
  SubBotInstance: MockInstanceCtor,
}));

vi.mock('../../../src/services/subbot/SubBotDatabase.js', () => ({
  subBotDatabase: mockDb,
}));

vi.mock('../../../src/services/system/AntiSpamService.js', () => ({
  AntiSpamService: class {
    startCleanup(): void {}
    stopCleanup(): void {}
  },
}));

vi.mock('../../../src/middlewares/ValidationMiddleware.js', () => ({
  ValidationMiddleware: class {},
}));
vi.mock('../../../src/middlewares/PermissionMiddleware.js', () => ({
  PermissionMiddleware: class {},
}));
vi.mock('../../../src/middlewares/CooldownMiddleware.js', () => ({
  CooldownMiddleware: class {},
}));
vi.mock('../../../src/middlewares/AntiSpamMiddleware.js', () => ({
  AntiSpamMiddleware: class {},
}));
vi.mock('../../../src/middlewares/AutoRegisterMiddleware.js', () => ({
  AutoRegisterMiddleware: class {},
}));
vi.mock('../../../src/middlewares/MuteMiddleware.js', () => ({ MuteMiddleware: class {} }));
vi.mock('../../../src/middlewares/LoggerMiddleware.js', () => ({ LoggerMiddleware: class {} }));

vi.mock('../../../src/services/system/Servicemanager.js', () => ({
  serviceManager: { groupService: { getGroup: (...args: unknown[]) => mockGetGroup(...args) } },
}));

vi.mock('../../../src/core/CommandRegistry.js', () => ({ commandRegistry: {} }));

vi.mock('../../../src/services/subbot/SubBotMessageHandler.js', () => ({
  SubBotMessageHandler: class {
    handleMessage = vi.fn(async () => {});
    handleGroupUpdate = vi.fn(async () => {});
  },
}));

vi.mock('../../../src/config/index.js', () => ({
  config: { prefix: '!', sessionPath: '/tmp/unused-session', auth: { usePairingCode: false } },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logError: vi.fn(),
}));

// --- Imports under test (after mocks) ---------------------------------------

import { SubBotManager } from '../../../src/services/subbot/SubBotManager.js';
import { SUBBOT_CONFIG } from '../../../src/config/subbot.js';

// --- Helpers ---------------------------------------------------------------

const OWNER_JID = '5215511112222@s.whatsapp.net';

function makeConfig(slot: number): SubBotConfig {
  return {
    id: `bot${slot}`,
    ownerJid: OWNER_JID,
    ownerName: 'Owner',
    phoneNumber: '5215599998888',
    sessionPath: join(tmpdir(), `subbot-session-${slot}`),
    prefix: '!',
    name: 'VaniaBot-Owner',
    active: true,
    createdAt: Date.now(),
    status: 'connecting',
    slot,
    label: `slot${slot}`,
  };
}

function freeSlot(n: number): SubBotSlot {
  return { slot: n, status: 'free' };
}

// --- Tests -----------------------------------------------------------------

describe('SubBotManager', () => {
  let manager: SubBotManager;
  let runtimeDir: string;
  let sessionsDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb.isPublicRequestsEnabled.mockReturnValue(true);
    runtimeDir = mkdtempSync(join(tmpdir(), 'vania-runtime-'));
    sessionsDir = mkdtempSync(join(tmpdir(), 'vania-subbot-sessions-'));
    Object.assign(SUBBOT_CONFIG, {
      RUNTIME_STATE_DIR: runtimeDir,
      SESSION_BASE_PATH: sessionsDir,
    });
    manager = SubBotManager.getInstance();
  });

  afterEach(async () => {
    await manager.shutdown();
    vi.useRealTimers();
    vi.clearAllMocks();
    instances.clear();
    mockDb.getActiveSlots.mockReturnValue([]);
    mockDb.getAllSlots.mockReturnValue([]);
    mockDb.getOwnerSlots.mockReturnValue([]);
    mockDb.isPublicRequestsEnabled.mockReturnValue(true);
    mockDb.reserveSlot.mockReturnValue(true);
    if (runtimeDir) rmSync(runtimeDir, { recursive: true, force: true });
    if (sessionsDir) rmSync(sessionsDir, { recursive: true, force: true });
  });

  it('initialize arranca los intervalos y shutdown los detiene', async () => {
    await manager.initialize();
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(instances.size).toBe(0);

    await manager.shutdown();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(instances.size).toBe(0);
  });

  it('initialize relanza instancias de slots connected/linking', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'connected', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));

    await manager.initialize();

    expect(instances.get('bot1')).toBeDefined();
  });

  it('initialize omite la auto-reconexión de slots disconnected', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'disconnected', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));

    await manager.initialize();

    expect(instances.size).toBe(0);
  });

  it('requestSubBot reserva, activa, lanza la instancia y marca pending', async () => {
    mockDb.getFreeSlot.mockReturnValue(freeSlot(3));
    const slotRef: SubBotSlot = { slot: 3, status: 'reserved' };
    mockDb.getSlot.mockReturnValue(slotRef);
    const subConfig = makeConfig(3);
    mockDb.activateSlot.mockReturnValue(subConfig);

    const result = await manager.requestSubBot(OWNER_JID, 'Owner', '+52 1 55 9999 8888');

    expect(mockDb.reserveSlot).toHaveBeenCalledWith(3, '5215599998888', 'Owner');
    // El id del subbot es randomBytes(8) en hex: no determinista
    expect(mockDb.activateSlot).toHaveBeenCalledWith(
      3,
      expect.stringMatching(/^[0-9a-f]{16}$/),
      OWNER_JID,
      'Owner',
      '5215599998888',
      'VaniaBot-Owner',
    );
    expect(slotRef.status).toBe('pending');
    expect(mockDb.save).toHaveBeenCalled();
    expect(instances.get('bot3')).toBeDefined();
    expect(result.subConfig).toBe(subConfig);
  });

  it('requestSubBot sin slots libres lanza error y no reserva nada', async () => {
    mockDb.getFreeSlot.mockReturnValue(undefined);

    await expect(manager.requestSubBot('owner@x', 'Owner', '555')).rejects.toThrow(
      'No hay slots disponibles',
    );
    expect(mockDb.reserveSlot).not.toHaveBeenCalled();
  });

  it('requestSubBot respeta solicitudes públicas desactivadas salvo para el owner', async () => {
    mockDb.isPublicRequestsEnabled.mockReturnValue(false);
    mockDb.getFreeSlot.mockReturnValue(freeSlot(2));

    await expect(manager.requestSubBot('owner@x', 'Owner', '555')).rejects.toThrow(
      'Las solicitudes de subbot están desactivadas',
    );

    const slotRef = freeSlot(2);
    mockDb.getSlot.mockReturnValue(slotRef);
    mockDb.activateSlot.mockReturnValue(makeConfig(2));

    const result = await manager.requestSubBot('owner@x', 'Owner', '555', 2, true);
    expect(result.subConfig).toBeDefined();
    expect(instances.get('bot2')).toBeDefined();
  });

  it('pairingCode: envía el código al owner y reenvía recordatorio a los 180s', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'linking', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    mockDb.getSlot.mockReturnValue({ slot: 1, id: 'bot1', status: 'pending' } as SubBotSlot);
    await manager.initialize();
    manager.setMainSocket(mockMainSock as unknown as WASocket);

    lastInstance()?.emitEvent('pairingCode', 'AB12-CD34');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockMainSock.sendMessage).toHaveBeenCalledWith(OWNER_JID, {
      text: expect.stringContaining('AB12-CD34'),
    });

    mockMainSock.sendMessage.mockClear();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(mockMainSock.sendMessage).toHaveBeenCalledWith(OWNER_JID, {
      text: expect.stringContaining('Recordatorio'),
    });
  });

  it('ready: marca connected, precarga grupos y notifica al owner', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'linking', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();
    manager.setMainSocket(mockMainSock as unknown as WASocket);

    const inst = lastInstance();
    (inst?.sock as { groupFetchAllParticipating: unknown } | undefined)[
      'groupFetchAllParticipating'
    ] = vi.fn(async () => ({ 'g1@g.us': {}, 'g2@g.us': {} }));

    inst?.emitEvent('ready');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(1, 'connected');
    expect(mockGetGroup).toHaveBeenCalledTimes(2);
    expect(mockMainSock.sendMessage).toHaveBeenCalledWith(
      OWNER_JID,
      expect.objectContaining({ text: expect.stringContaining('SubBot activada') }),
    );
  });

  it('sessionInvalid: marca disconnected, borra la sesión y notifica al owner', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'connected', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();
    manager.setMainSocket(mockMainSock as unknown as WASocket);

    const sessionDir = join(sessionsDir, 'bot1');
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(join(sessionDir, 'creds.json'), '{}');

    lastInstance()?.emitEvent('sessionInvalid');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(1, 'disconnected');
    expect(existsSync(sessionDir)).toBe(false);
    expect(mockMainSock.sendMessage).toHaveBeenCalledWith(
      OWNER_JID,
      expect.objectContaining({ text: expect.stringContaining('reconbot') }),
    );
  });

  it('disconnected actualiza el estado del slot', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'linking', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();

    lastInstance()?.emitEvent('disconnected');

    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(1, 'disconnected');
  });

  it('health check reactiva slots activos cuya instancia ya no existe', async () => {
    // initialize sin slots activos; el slot aparece después (alta en caliente)
    await manager.initialize();

    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'connected', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));

    await vi.advanceTimersByTimeAsync(120_000);

    expect(instances.get('bot1')).toBeDefined();
  });

  it('health check reinicia slots linking stale (>5 min sin conectar)', async () => {
    const staleSlot = {
      slot: 2,
      id: 'bot2',
      status: 'linking',
      ownerJid: OWNER_JID,
      requestedAt: Date.now() - 6 * 60_000,
    } as SubBotSlot;
    mockDb.getActiveSlots.mockReturnValue([staleSlot]);
    mockDb.get.mockReturnValue(makeConfig(2));
    mockDb.getOwnerSlots.mockReturnValue([{ id: 'bot2' }]);
    mockDb.getOwnerSlotById.mockReturnValue({ slot: 2, id: 'bot2' } as SubBotSlot);
    await manager.initialize();

    const before = instances.get('bot2');
    expect(before).toBeDefined();

    await vi.advanceTimersByTimeAsync(120_000);

    // reconnectByOwner: stop de la vieja + pending + nueva instancia
    expect(before?.stopped).toBe(true);
    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(2, 'pending');
    expect(instances.get('bot2')).toBeDefined();
    expect(instances.get('bot2')).not.toBe(before);
  });

  it('health check resetea slots pending con pairing stale (>5 min)', async () => {
    // El runtime state en memoria solo existe tras launchInstance, así que el
    // flujo real es: requestSubBot → pending → owner nunca usa el código → stale
    mockDb.isPublicRequestsEnabled.mockReturnValue(true);
    const staleSlot: SubBotSlot = { slot: 4, status: 'free', id: 'bot4', ownerJid: OWNER_JID };
    mockDb.getActiveSlots.mockReturnValue([staleSlot]);
    mockDb.getSlot.mockReturnValue(staleSlot);
    mockDb.get.mockImplementation((id: string) =>
      id === 'bot4' ? makeConfig(4) : undefined,
    );
    mockDb.getFreeSlot.mockReturnValue({ ...staleSlot, status: 'free' as SubBotSlotStatus });
    mockDb.activateSlot.mockReturnValue(makeConfig(4));

    await manager.requestSubBot(OWNER_JID, 'Owner', '+52 1 55 9999 8888');
    expect(staleSlot.status).toBe('pending');

    // initialize arranca el health check; el slot pending no se relanza
    await manager.initialize();

    // 6 minutos sin usar el código (stale > 5 min) + tick del health check
    await vi.advanceTimersByTimeAsync(6 * 60_000 + 120_000);

    // resetSlot: detiene la instancia, libera el slot y persiste
    expect(instances.get('bot4')?.stopped).toBe(true);
    expect(staleSlot.status).toBe('free');
    expect(staleSlot.id).toBeUndefined();
    expect(mockDb.save).toHaveBeenCalled();
  });

  it('stopSubBot detiene la instancia del owner y marca disconnected', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'linking', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();

    mockDb.getOwnerSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'connected' } as SubBotSlot,
    ]);

    await manager.stopSubBot(OWNER_JID);

    expect(instances.get('bot1')?.stopped).toBe(true);
    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(1, 'disconnected');
  });

  it('stopSubBot sin subbot activa lanza error', async () => {
    await expect(manager.stopSubBot('o@x')).rejects.toThrow('No tienes una subbot activa.');
  });

  it('deleteSubBot detiene, borra sesión y runtime, y libera el slot', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'connected', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();

    const sessionDir = join(sessionsDir, 'bot1');
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(join(sessionDir, 'creds.json'), '{}');

    mockDb.getOwnerSlots.mockReturnValue([{ id: 'bot1' }]);
    mockDb.getOwnerSlotById.mockReturnValue({
      slot: 1,
      id: 'bot1',
      status: 'connected',
    } as SubBotSlot);

    await manager.deleteSubBot(OWNER_JID);

    expect(instances.get('bot1')?.stopped).toBe(true);
    expect(existsSync(join(sessionsDir, 'bot1'))).toBe(false);
    expect(existsSync(join(runtimeDir, 'bot1.json'))).toBe(false);
    expect(mockDb.releaseSlot).toHaveBeenCalledWith(1);
  });

  it('reconnectByOwner relanza la instancia y pasa por pending→linking', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'connected', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();

    mockDb.getOwnerSlots.mockReturnValue([{ id: 'bot1' }]);
    mockDb.getOwnerSlotById.mockReturnValue({ slot: 1, id: 'bot1' } as SubBotSlot);

    const before = instances.get('bot1');

    await manager.reconnectByOwner(OWNER_JID);

    expect(before?.stopped).toBe(true);
    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(1, 'pending');
    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(1, 'linking');
  });

  it('recoverOrphanedSessions recupera sesiones huérfanas en slots free', async () => {
    mkdirSync(join(sessionsDir, 'orphan1'), { recursive: true });
    writeFileSync(join(sessionsDir, 'orphan1', 'creds.json'), '{}');
    mockDb.getAllSlots.mockReturnValue([
      { slot: 5, id: 'orphan1', status: 'free' } as SubBotSlot,
    ]);

    await manager.initialize();

    expect(mockDb.updateSlotStatus).toHaveBeenCalledWith(5, 'disconnected');
  });

  it('recoverOrphanedSessions ignora sesiones sin slot correspondiente', async () => {
    mkdirSync(join(sessionsDir, 'desconocida'), { recursive: true });
    writeFileSync(join(sessionsDir, 'desconocida', 'creds.json'), '{}');
    mockDb.getAllSlots.mockReturnValue([
      { slot: 6, id: 'otro', status: 'free' } as SubBotSlot,
    ]);

    await manager.initialize();

    expect(mockDb.updateSlotStatus).not.toHaveBeenCalled();
  });

  it('getStatus y getters delegan en la base de datos', () => {
    const owned = { slot: 7, id: 'b7', status: 'connected', ownerJid: 'o@x' } as SubBotSlot;
    mockDb.getSlot.mockReturnValue(owned);
    mockDb.getAllSlots.mockReturnValue([owned, { slot: 8 } as SubBotSlot]);
    mockDb.getOwnerSlots.mockReturnValue([{ id: 'b7' }]);
    mockDb.getOwnerSlotById.mockReturnValue(owned);
    mockDb.getActiveSlots.mockReturnValue([owned, { slot: 8 } as SubBotSlot]);

    expect(manager.getStatus('o@x', 7)).toBe(owned);
    expect(manager.getStatus('otro@x', 7)).toBeNull();
    expect(manager.getStatus('o@x')).toBe(owned);
    expect(manager.getAllStatus()).toHaveLength(2);
    expect(manager.getTotalConnected()).toBe(1);
    expect(manager.getSlotInfo(7)).toBe(owned);
  });

  it('shutdown persiste el runtime state y detiene todas las instancias', async () => {
    mockDb.getActiveSlots.mockReturnValue([
      { slot: 1, id: 'bot1', status: 'linking', ownerJid: OWNER_JID } as SubBotSlot,
    ]);
    mockDb.get.mockReturnValue(makeConfig(1));
    await manager.initialize();

    await manager.shutdown();

    // El manager limpia su mapa interno; las instancias mock deben quedar detenidas
    expect([...instances.values()].every(i => i.stopped)).toBe(true);
    expect(existsSync(join(runtimeDir, 'bot1.json'))).toBe(true);
  });
});
