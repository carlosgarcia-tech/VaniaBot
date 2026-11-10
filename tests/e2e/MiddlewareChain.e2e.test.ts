/**
 * MiddlewareChain.e2e.test.ts
 *
 * Characterization of the middleware chain via observable effects:
 * LoggerMiddleware increments the user's and the group's command counters,
 * and ValidationMiddleware stops execution when the context doesn't apply
 * (covered in CommandContexts.e2e.test.ts).
 *
 * These counters had no coverage at all: they are state written to the
 * database through the real middleware chain.
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
const wait = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: cadena de middlewares', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un comando en privado suma al contador del usuario',
    async () => {
      const jid = senderJid(640);
      const { serviceManager } = await import('@/services/system/Servicemanager.js');

      const before = (await serviceManager.userService.getUser(jid)).totalCommands;

      socket.receive(dmTextMessage('!ping', jid));
      await wait();
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);

      const after = (await serviceManager.userService.getUser(jid)).totalCommands;
      expect(after).toBe(before + 1);
    },
    TIMEOUT,
  );

  it(
    'un comando en grupo suma a los contadores del usuario y del grupo',
    async () => {
      const group = `1203630366666666${String(Date.now() % 100).padStart(2, '0')}@g.us`;
      const jid = senderJid(641);

      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
      await setParticipants(socket, group, [botAdmin(), member(jid)]);
      await serviceManager.groupService.getGroup(group);

      const userBefore = (await serviceManager.userService.getUser(jid)).totalCommands;
      const groupBefore =
        (await serviceManager.groupService.getGroup(group)).stats.totalCommands;

      socket.receive(groupTextMessage('!ping', group, jid));
      await wait();
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);

      const userAfter = (await serviceManager.userService.getUser(jid)).totalCommands;
      const groupAfter = (await serviceManager.groupService.getGroup(group)).stats
        .totalCommands;

      expect(userAfter).toBe(userBefore + 1);
      expect(groupAfter).toBe(groupBefore + 1);
    },
    TIMEOUT,
  );
});
