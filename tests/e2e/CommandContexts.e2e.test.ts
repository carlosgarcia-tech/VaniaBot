/**
 * CommandContexts.e2e.test.ts
 *
 * ValidationMiddleware.contexts in production: which commands are rejected
 * outside their context, and which owner commands do listen to their owner.
 *
 * The filter uses the real CommandRegistry, so the names used in the test
 * are the ones the bot actually registers.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { dmTextMessage, groupTextMessage, senderJid } from './harness/fixtures.js';
import { botAdmin, member, setParticipants } from './harness/groups.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/** First configured owner as a WhatsApp JID. */
async function ownerJid(): Promise<string> {
  const { config } = await import('@/config/index.js');
  const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
  return `${ownerPhone}@s.whatsapp.net`;
}

describe('e2e: contextos de comando (grupo vs privado)', () => {
  let socket: BootState['socket'];
  let caseCounter = 0;

  /** Fresh group per case: the load counters live for the whole boot. */
  async function freshGroup(): Promise<string> {
    caseCounter++;
    const group = `1203630377777777${String(caseCounter).padStart(2, '0')}@g.us`;
    const memberJid = senderJid(600 + caseCounter);

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
    await setParticipants(socket, group, [botAdmin(), member(memberJid)]);

    return group;
  }

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un comando de grupo se rechaza en privado con el nombre del contexto',
    async () => {
      // !sleep is GROUP-only.
      socket.receive(dmTextMessage('!sleep 5m', senderJid(610)));

      await wait();

      expect(socket.texts()).toEqual(['❌ Este comando solo funciona en grupos']);
      // And the command never executed: SleepCommand reacts with 😴.
      expect(socket.reactions()).not.toContain('😴');
    },
    TIMEOUT,
  );

  it(
    'un comando de privado se rechaza en grupo con el nombre del contexto',
    async () => {
      const group = await freshGroup();

      // !metrics is PRIVATE-only and also OWNER.
      socket.receive(groupTextMessage('!metrics', group, await ownerJid()));

      await wait();

      // Only the context warning: if ValidationMiddleware didn't stop the
      // chain, the metrics would print in the group too.
      expect(socket.texts()).toEqual(['❌ Este comando solo funciona en chats privados']);
      expect(socket.texts().some(t => t.includes('Métricas'))).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'el mismo comando de grupo sí funciona dentro del grupo',
    async () => {
      const group = await freshGroup();
      const adminJid = await ownerJid();

      socket.receive(groupTextMessage('!sleep 5m', group, adminJid));

      await wait();

      expect(
        socket.texts().some(t => t.includes('solo funciona en')),
      ).toBe(false);
    },
    TIMEOUT,
  );
});
