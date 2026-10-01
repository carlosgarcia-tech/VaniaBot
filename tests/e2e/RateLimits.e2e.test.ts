/**
 * RateLimits.e2e.test.ts
 *
 * Límites de tasa del pipeline (MainMessagePipeline.checkRateLimits) con el
 * bot real y los servicios reales de anti-spam:
 *
 *   - AntiSpamService: 3 mensajes/segundo y 20 por minuto (con baneo de
 *     5 minutos) tanto en DM como en grupo.
 *   - RateLimitService.checkFlood: 3/segundo por usuario (solo grupo).
 *   - RateLimitService.checkGroupRateLimit: 30 por minuto y escalado de
 *     avisos a bloqueo del grupo.
 *
 * Dos detalles del orden de ejecución que los tests respetan:
 *
 *   1. checkRateLimits corre DESPUÉS de runGuards. En grupo, la charla sin
 *      comando se la traga handleGroupConversation, así que los límites de
 *      tasa solo se ven sobre comandos.
 *   2. AntiSpamService se consulta antes que RateLimitService.checkFlood y
 *      ambos comparten el umbral de 3/segundo: el corte por segundo lo
 *      reporta siempre AntiSpamService, y checkFlood queda cubierto por su
 *      test unitario (tests/services/RateLimitService.test.ts).
 *
 * Cada test usa un grupo distinto porque el contador de carga es por grupo y
 * vive durante todo el boot del proceso. Para los contadores por minuto se
 * adelanta el reloj con vi.setSystemTime (toFake: ['Date']): sin eso, el
 * límite por segundo cortaría antes de llegar al de minutos.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { dmTextMessage, groupMessageFrom, senderJid } from './harness/fixtures.js';
import { clearParticipants } from './harness/groups.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;

const FAST_WRITE = '⚠️ Estás escribiendo muy rápido';
const BAN_WARNING = '⚠️ Demasiados mensajes. Bloqueado temporalmente.';
const BAN_BLOCK = '⛔ Bloqueado temporalmente por spam';
const GROUP_BUSY = '⚠️ El grupo está enviando muchos mensajes. Reduce la velocidad.';
const GROUP_SLOWER = '⚠️ Demasiados mensajes del grupo';
const GROUP_BLOCKED = '⛔ Grupo bloqueado temporalmente por spam';

/** Espera a que el pipeline (queueMicrotask + setImmediate) termine. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envía un comando cada ~1.2 s de reloj (bajo el límite por segundo, dentro
 * de la ventana de un minuto) y devuelve los textos enviados.
 */
async function sendSpaced(
  socket: BootState['socket'],
  send: (i: number) => void,
  count: number,
): Promise<string[]> {
  vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
  for (let i = 0; i < count; i++) {
    vi.setSystemTime(Date.now() + 1_200);
    send(i);
    await wait(120);
  }
  return socket.texts();
}

describe('e2e: límites de tasa del pipeline', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'en DM el cuarto mensaje del mismo segundo se bloquea por escritura rápida',
    async () => {
      const sender = senderJid(1);

      for (let i = 0; i < 4; i++) socket.receive(dmTextMessage('!ping', sender));
      await wait(500);

      const texts = socket.texts();
      // El límite es 3 por segundo: solo el cuarto mensaje se corta.
      expect(texts.filter(t => t === FAST_WRITE)).toHaveLength(1);
      // Y el corte ocurre antes de la cadena de middlewares: un solo Pong.
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'tras un segundo de silencio el remitente puede volver a escribir',
    async () => {
      const sender = senderJid(2);

      for (let i = 0; i < 4; i++) socket.receive(dmTextMessage('!ping', sender));
      await wait(500);
      expect(socket.texts().filter(t => t === FAST_WRITE)).toHaveLength(1);

      // 4 s adelante: superan tanto la ventana por segundo como el cooldown.
      vi.useFakeTimers({ now: Date.now() + 4_000, toFake: ['Date'] });
      socket.reset();

      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      expect(socket.texts()).not.toContain(FAST_WRITE);
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'superar los 20 mensajes por minuto banea al remitente y el siguiente mensaje confirma el bloqueo',
    async () => {
      const sender = senderJid(3);

      // 25 intentos: el baneo debe ocurrir dentro del rango del minuto.
      const texts = await sendSpaced(socket, () => socket.receive(dmTextMessage('!ping', sender)), 25);

      expect(texts).toContain(BAN_WARNING);
      // El baneo corta la ejecución: tras el aviso no vuelve a responder el comando.
      expect(texts.filter(t => t.startsWith('🏓 Pong!')).length).toBeGreaterThan(0);

      socket.reset();
      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      expect(socket.texts()).toEqual([BAN_BLOCK]);
    },
    TIMEOUT,
  );

  it(
    'en grupo el cuarto comando seguido del mismo usuario se corta antes de ejecutar',
    async () => {
      const group = '120363032222222201@g.us';
      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');
      await clearParticipants(socket, group);

      const sender = senderJid(4);
      for (let i = 0; i < 4; i++) {
        socket.receive(groupMessageFrom(group, sender, '!ping', 'Tester'));
      }
      await wait(600);

      const texts = socket.texts();
      expect(texts.filter(t => t === FAST_WRITE)).toHaveLength(1);
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'la carga del grupo se avisa, luego se recuerda y acaba bloqueando el chat',
    async () => {
      const group = '120363032222222202@g.us';
      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');
      await clearParticipants(socket, group);

      // Un remitente por mensaje: ningún límite por usuario se cruza antes.
      const texts = await sendSpaced(
        socket,
        i => socket.receive(groupMessageFrom(group, senderJid(100 + i), '!ping', `Tester${i}`)),
        34,
      );

      const notPong = texts.filter(t => !t.startsWith('🏓'));
      expect(notPong).toEqual([GROUP_BUSY, GROUP_SLOWER, GROUP_BLOCKED, GROUP_BLOCKED]);
      // 30 comandos llegaron a ejecutarse antes del bloqueo.
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(30);
    },
    TIMEOUT,
  );

  it(
    'un usuario sin actividad no hereda el bloqueo de flood de otro',
    async () => {
      const group = '120363032222222203@g.us';
      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');
      await clearParticipants(socket, group);

      const flooder = senderJid(5);
      const calm = senderJid(6);

      for (let i = 0; i < 4; i++) {
        socket.receive(groupMessageFrom(group, flooder, '!ping', 'Flooder'));
      }
      await wait(600);
      expect(socket.texts()).toContain(FAST_WRITE);

      socket.reset();
      socket.receive(groupMessageFrom(group, calm, '!ping', 'Tranquilo'));
      await wait();

      expect(socket.texts()).not.toContain(FAST_WRITE);
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );
});
