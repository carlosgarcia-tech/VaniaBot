/**
 * NsfwToggleService.test.ts
 *
 * Unit tests for the persistent NSFW toggle: global default, per-group
 * override, and fail-closed behavior when the DB is unavailable.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NsfwToggleService } from '../../src/services/system/NsfwToggleService.js';

function createMockDb() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (_collection: string, key: string) => store.get(key) ?? null),
    set: vi.fn(async (_collection: string, key: string, value: unknown) => {
      store.set(key, value);
    }),
    flush: vi.fn(async () => {}),
  };
}

// vi is available globally in vitest, but import for typing clarity.
import { vi } from 'vitest';

describe('NsfwToggleService', () => {
  let service: NsfwToggleService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    service = new NsfwToggleService();
    service.setDatabase(db as never);
  });

  it('defaults to disabled when nothing is configured', async () => {
    await expect(service.isEnabled(null)).resolves.toBe(false);
    await expect(service.isEnabled('123@g.us')).resolves.toBe(false);
  });

  it('returns the global state for DMs', async () => {
    await service.setEnabled(true, 'owner@test.com', null);
    await expect(service.isEnabled(null)).resolves.toBe(true);
  });

  it('persists state in the nsfw_toggle collection', async () => {
    await service.setEnabled(true, 'owner@test.com', null);

    expect(db.set).toHaveBeenCalledWith(
      'nsfw_toggle',
      'global',
      expect.objectContaining({ enabled: true, changedBy: 'owner@test.com', scope: 'global' }),
    );
    expect(db.flush).toHaveBeenCalled();
  });

  it('uses the group JID as key for group-scoped changes', async () => {
    await service.setEnabled(true, 'admin@test.com', '987@g.us');

    expect(db.set).toHaveBeenCalledWith(
      'nsfw_toggle',
      '987@g.us',
      expect.objectContaining({ enabled: true, scope: '987@g.us' }),
    );
  });

  it('lets the group record override the global one', async () => {
    await service.setEnabled(true, 'owner@test.com', null); // global ON
    await service.setEnabled(false, 'admin@test.com', '123@g.us'); // group OFF

    await expect(service.isEnabled('123@g.us')).resolves.toBe(false);
    await expect(service.isEnabled('456@g.us')).resolves.toBe(true); // global fallback
    await expect(service.isEnabled(null)).resolves.toBe(true);
  });

  it('falls back to global when the group has no record', async () => {
    await service.setEnabled(true, 'owner@test.com', null);
    await expect(service.isEnabled('789@g.us')).resolves.toBe(true);
  });

  it('fails closed when the database is not ready', async () => {
    const uninitialized = new NsfwToggleService();
    await expect(uninitialized.isEnabled(null)).resolves.toBe(false);
    await expect(uninitialized.isEnabled('123@g.us')).resolves.toBe(false);
  });

  it('reflects the latest change when toggled repeatedly', async () => {
    await service.setEnabled(true, 'a@test.com', '123@g.us');
    await expect(service.isEnabled('123@g.us')).resolves.toBe(true);
    await service.setEnabled(false, 'a@test.com', '123@g.us');
    await expect(service.isEnabled('123@g.us')).resolves.toBe(false);
  });
});
