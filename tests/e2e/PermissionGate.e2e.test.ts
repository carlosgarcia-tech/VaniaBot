/**
 * PermissionGate.e2e.test.ts
 *
 * Permission gating through the real bot: an OWNER-only command (MetricsCommand)
 * run by a regular user must receive the PermissionMiddleware denial without
 * ever executing the command.
 *
 * The denial happens inside the middleware chain (after registry resolution),
 * so this test proves the e2e flow reaches PermissionMiddleware — not just a
 * happy-path execution.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { dmTextMessage, groupTextMessage, senderJid } from './harness/fixtures.js';
import { member, setParticipants } from './harness/groups.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: puerta de permisos', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un usuario normal recibe la denegación al usar un comando OWNER-only',
    async () => {
      socket.receive(dmTextMessage('!metrics', senderJid(1)));
      await wait();

      const texts = socket.texts();
      expect(texts).toContain('❌ No tienes permiso para usar este comando');
      // The command never got to run: no metrics reaction
      expect(socket.sent.some(m => (m.content as { text?: string }).text?.includes('Métricas de OrbitBot'))).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'el alias de un comando OWNER-only pasa por la misma puerta',
    async () => {
      socket.receive(dmTextMessage('!botstats', senderJid(2)));
      await wait();

      expect(socket.texts()).toContain('❌ No tienes permiso para usar este comando');
    },
    TIMEOUT,
  );

  it(
    'un owner de configuración sí puede usar el comando OWNER-only',
    async () => {
      const { config } = await import('@/config/index.js');
      const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
      const ownerJid = `${ownerPhone}@s.whatsapp.net`;

      socket.receive(dmTextMessage('!metrics', ownerJid));
      await wait();

      // The gate lets it through and the command really executes.
      expect(socket.texts().some(t => t.includes('Métricas de OrbitBot'))).toBe(true);
      expect(socket.texts()).not.toContain('❌ No tienes permiso para usar este comando');
    },
    TIMEOUT,
  );

  it(
    'un owner es tratado como admin en grupo y pasa un comando ADMIN-only',
    async () => {
      const group = `1203630355555555${String(Date.now() % 100).padStart(2, '0')}@g.us`;
      const { config } = await import('@/config/index.js');
      const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
      const ownerJid = `${ownerPhone}@s.whatsapp.net`;

      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
      // Neither the owner nor the bot is listed as admin: the owner must
      // cover for it.
      await setParticipants(socket, group, [{ id: ownerJid }, member(senderJid(3))]);

      // !mutelist is GROUP + ADMIN-only.
      socket.receive(groupTextMessage('!mutelist', group, ownerJid));
      await wait();

      expect(socket.texts()).not.toContain('❌ No tienes permiso para usar este comando');
    },
    TIMEOUT,
  );
});
