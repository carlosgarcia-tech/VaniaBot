/**
 * PersistenceService.test.ts
 *
 * Unit tests for the persistence edge paths: save failures are captured
 * and logged instead of becoming unhandled rejections (the save callers
 * are fire-and-forget `void` calls), reminder delivery failures are
 * logged, and reminder cleanup frees its timer.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted mock state -----------------------------------------------------

const { mockDb, mockLogError } = vi.hoisted(() => ({
  mockDb: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => {}),
  },
  mockLogError: vi.fn(),
}));

// --- Module mocks -----------------------------------------------------------

vi.mock('../../src/services/database/Database.js', () => ({
  Database: class {},
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logError: mockLogError,
}));

// --- Imports under test (after mocks) ---------------------------------------

import { PersistenceService } from '../../src/services/system/PersistenceService.js';
import type { Reminder } from '../../src/services/system/PersistenceService.js';

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'R-1',
    userJid: 'u@s.whatsapp.net',
    chatJid: 'c@s.whatsapp.net',
    message: 'hola',
    triggerAt: Date.now() + 60_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('PersistenceService', () => {
  let service: PersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.get.mockResolvedValue(undefined);
    mockDb.set.mockResolvedValue(undefined);
    service = PersistenceService.getInstance();
    service.setDatabase(mockDb as never);
  });

  afterEach(() => {
    service.stop();
  });

  it('addReminder persiste y no lanza aunque el save falle', async () => {
    mockDb.set.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      Promise.resolve(service.addReminder(makeReminder())),
    ).resolves.toBeUndefined();

    // Espera al fire-and-forget: el fallo debe capturarse y loguearse,
    // nunca convertirse en unhandled rejection.
    await vi.waitFor(() => {
      expect(mockLogError).toHaveBeenCalledWith(
        'PersistenceService.saveReminders',
        expect.any(Error),
      );
    });
  });

  it('el fallo al enviar el recordatorio se loguea y el recordatorio se limpia', async () => {
    const sock = { sendMessage: vi.fn().mockRejectedValue(new Error('connection closed')) };
    service.setSocket(sock as never);

    service.addReminder(makeReminder({ triggerAt: Date.now() + 10 }));

    await vi.waitFor(() => {
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('sendReminder R-1'),
        expect.any(Error),
      );
    });

    // Aunque el envío falló, el recordatorio se saca del mapa (no se reintenta)
    await vi.waitFor(() => {
      expect(service.getReminder('R-1')).toBeUndefined();
    });
  });

  it('el envío exitoso del recordatorio no loguea errores', async () => {
    const sock = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    service.setSocket(sock as never);

    service.addReminder(makeReminder({ triggerAt: Date.now() + 10 }));

    await vi.waitFor(() => {
      expect(sock.sendMessage).toHaveBeenCalled();
    });
    expect(mockLogError).not.toHaveBeenCalledWith(
      expect.stringContaining('sendReminder'),
      expect.anything(),
    );
  });

  it('removeReminder limpia el timer y persiste el cambio', async () => {
    service.addReminder(makeReminder());
    service.removeReminder('R-1');

    expect(service.getReminder('R-1')).toBeUndefined();
    await vi.waitFor(() => {
      expect(mockDb.set).toHaveBeenCalled();
    });
  });

  it('los saves sin base de datos son no-ops', () => {
    const bare = new PersistenceService();
    expect(() => bare.addReminder(makeReminder())).not.toThrow();
    bare.stop();
  });
});
