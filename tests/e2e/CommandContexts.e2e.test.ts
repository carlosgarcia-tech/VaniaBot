/**
 * CommandContexts.e2e.test.ts
 *
 * ValidationMiddleware.contexts en producción: qué comandos se rechazan
 * fuera de su contexto y qué comandos de owner sí oyen a su owner.
 *
 * El filtro se hace con el CommandRegistry real, así que los nombres usados
 * en el test son los que el bot registra de verdad.
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

/** Primer owner de configuración como JID de WhatsApp. */
async function ownerJid(): Promise<string> {
  const { config } = await import('@/config/index.js');
  const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
  return `${ownerPhone}@s.whatsapp.net`;
}

describe('e2e: contextos de comando (grupo vs privado)', () => {
  let socket: BootState['socket'];
  let caseCounter = 0;

  /** Grupo nuevo por caso: los contadores de carga viven todo el boot. */
  async function freshGroup(): Promise<string> {
    caseCounter++;
    const group = `1203630377777777${String(caseCounter).padStart(2, '0')}@g.us`;
    const memberJid = senderJid(600 + caseCounter);

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');
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
      // !sleep es GROUP-only.
      socket.receive(dmTextMessage('!sleep 5m', senderJid(610)));

      await wait();

      expect(socket.texts()).toEqual(['❌ Este comando solo funciona en grupos']);
      // Y el comando no llegó a ejecutarse: SleepCommand reacciona con 😴.
      expect(socket.reactions()).not.toContain('😴');
    },
    TIMEOUT,
  );

  it(
    'un comando de privado se rechaza en grupo con el nombre del contexto',
    async () => {
      const group = await freshGroup();

      // !metrics es PRIVATE-only y además OWNER.
      socket.receive(groupTextMessage('!metrics', group, await ownerJid()));

      await wait();

      // Solo el aviso de contexto: si ValidationMiddleware no cortara la
      // cadena, las métricas se imprimirían también en el grupo.
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
