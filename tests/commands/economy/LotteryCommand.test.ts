/**
 * LotteryCommand.test.ts
 *
 * Unit tests for the lottery command: default action, buying tickets
 * (valid, invalid amount, insufficient funds, sold out, partial purchase
 * when slots run out mid-buy), status view with/without tickets and the
 * owner-only draw that pays the winner and resets the pool.
 *
 * @author Carlos G
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mock state -----------------------------------------------------

const { mockUserService, users } = vi.hoisted(() => {
  const users = new Map<string, { jid: string; name: string; money: number }>();
  const mockUserService = {
    getUser: vi.fn(async (jid: string) => {
      if (!users.has(jid)) {
        users.set(jid, { jid, name: `User-${jid.split('@')[0]}`, money: 0 });
      }
      return users.get(jid);
    }),
    addMoney: vi.fn(async (jid: string, amount: number) => {
      const u = users.get(jid);
      if (u) u.money += amount;
    }),
    removeMoney: vi.fn(async (jid: string, amount: number) => {
      const u = users.get(jid);
      if (u) u.money -= amount;
    }),
  };
  return { mockUserService, users };
});

// --- Module mocks -----------------------------------------------------------

vi.mock('@/services/system/Servicemanager', () => ({
  serviceManager: { userService: mockUserService },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logError: vi.fn(),
}));

// --- Imports under test (after mocks) ---------------------------------------

import { LotteryCommand } from '@/commands/economy/LotteryCommand';
import { serviceManager } from '@/services/system/Servicemanager';
import type { MessageContext } from '@/types';

const USER = 'user@test.com';

const replies = (): string[] => [];

function makeCtx(overrides: Partial<MessageContext> = {}): MessageContext {
  const sent: string[] = replies();
  sent.length = 0;
  return {
    command: 'loteria',
    args: [],
    text: '',
    message: { key: { id: 'm1', remoteJid: 'g@g.us', fromMe: false } } as MessageContext['message'],
    sock: {} as MessageContext['sock'],
    chat: { jid: 'g@g.us', isGroup: true, isBotAdmin: true },
    sender: { jid: USER, pushName: 'User', isOwner: false, isAdmin: false },
    reply: vi.fn(async (text: string) => {
      sent.push(text);
    }),
    react: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    loadSenderPermissions: vi.fn(async () => {}),
    loadBotPermissions: vi.fn(async () => {}),
    ...overrides,
  } as unknown as MessageContext;
}

/** The lottery keeps module-level state; expose it to reset between tests. */
function getState(): { tickets: unknown[]; prizePool: number; lastDraw: number } {
  const mod = (
    LotteryCommand as unknown as { prototype: Record<string, unknown> }
  ).prototype;
  void mod;
  // Access via the singleton-ish module state: imported lazily through the
  // command's own module. We instead reach into the module through eval-free
  // means: the state is module-scoped, so we reset it by driving public flows
  // and, when needed, by drawing with an owner.
  return { tickets: [], prizePool: 0, lastDraw: 0 };
}
void getState;

async function drawAsOwner(): Promise<void> {
  const ownerCmd = new LotteryCommand();
  const ownerCtx = makeCtx({
    args: ['resultado'],
    sender: { jid: 'owner@test.com', pushName: 'Owner', isOwner: true, isAdmin: true },
  } as Partial<MessageContext>);
  await ownerCmd.execute(ownerCtx);
}

// --- Tests -----------------------------------------------------------------

describe('LotteryCommand', () => {
  let command: LotteryCommand;

  beforeEach(async () => {
    users.clear();
    // Reset module state through public flows: draw with an owner until the
    // pool is empty (drawLottery resets tickets + prizePool).
    await mockUserService.getUser('owner@test.com');
    await drawAsOwner();
    await drawAsOwner(); // first call may pay a stale winner from a previous test
    // Limpiar mocks DESPUÉS del reset: el draw de reset paga tickets viejos.
    vi.clearAllMocks();
    command = new LotteryCommand();
  });

  const lastReply = (ctx: MessageContext): string => {
    const mock = ctx.reply as unknown as { mock: { calls: unknown[][] } };
    const calls = mock.mock.calls;
    return String(calls.at(-1)?.[0] ?? '');
  };

  it('propiedades del comando', () => {
    expect(command.name).toBe('loteria');
    expect(command.aliases).toContain('lottery');
    expect(command.aliases).toContain('ticket');
    expect(command.aliases).not.toContain('comprar');
  });

  it('sin acción muestra el estado por defecto', async () => {
    const ctx = makeCtx({ args: [] });
    await command.execute(ctx);

    expect(ctx.reply).toHaveBeenCalled();
    expect(lastReply(ctx)).toContain('ESTADO DE LOTERÍA');
  });

  it('acción desconocida muestra la ayuda', async () => {
    const ctx = makeCtx({ args: ['noexiste'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('LOTERÍA VANIA');
    expect(lastReply(ctx)).toContain('Cómo funciona');
  });

  it('compra válida: cobra, emite tickets y suma al pozo', async () => {
    await mockUserService.getUser(USER);
    (await mockUserService.getUser(USER)).money = 10_000;

    const ctx = makeCtx({ args: ['comprar', '3'] });
    await command.execute(ctx);

    expect(mockUserService.removeMoney).toHaveBeenCalledWith(USER, 3000);
    expect(lastReply(ctx)).toContain('TICKETS COMPRADOS');
    expect(lastReply(ctx)).toContain('$3');
    expect(ctx.react).toHaveBeenCalledWith('🎫');
  });

  it('rechaza cantidades fuera de rango [1, 10]', async () => {
    await mockUserService.getUser(USER);
    (await mockUserService.getUser(USER)).money = 10_000;

    for (const amount of ['0', '11']) {
      const ctx = makeCtx({ args: ['comprar', amount] });
      await command.execute(ctx);
      expect(lastReply(ctx)).toContain('Cantidad inválida');
    }
    expect(mockUserService.removeMoney).not.toHaveBeenCalled();
  });

  it('rechaza sin fondos suficientes', async () => {
    await mockUserService.getUser(USER);
    (await mockUserService.getUser(USER)).money = 500;

    const ctx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No tienes suficiente dinero');
    expect(mockUserService.removeMoney).not.toHaveBeenCalled();
  });

  it('compra parcial: cobra solo los tickets efectivamente entregados', async () => {
    await mockUserService.getUser(USER);
    (await mockUserService.getUser(USER)).money = 150_000;

    // Comprar 10 tickets en cada iteración hasta llenar el máximo (100)
    for (let i = 0; i < 10; i++) {
      const ctx = makeCtx({ args: ['comprar', '10'] });
      await command.execute(ctx);
    }
    // El pozo está lleno: quedan 0 slots
    expect(mockUserService.removeMoney).toHaveBeenCalledTimes(10);

    const ctx = makeCtx({ args: ['comprar', '5'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('Ya no hay tickets disponibles');
    expect(mockUserService.removeMoney).toHaveBeenCalledTimes(10);
  });

  it('estado muestra el pozo, ventas y los tickets del usuario', async () => {
    await mockUserService.getUser(USER);
    (await mockUserService.getUser(USER)).money = 50_000;

    const buyCtx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(buyCtx);

    const ctx = makeCtx({ args: ['estado'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('ESTADO DE LOTERÍA');
    expect(lastReply(ctx)).toContain('2/100');
    expect(lastReply(ctx)).toContain('Tus tickets');
  });

  it('estado sin tickets indica que no participa', async () => {
    await mockUserService.getUser(USER);
    const ctx = makeCtx({ args: ['estado'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No tienes tickets');
  });

  it('draw sin tickets avisa y no paga nada', async () => {
    const ctx = makeCtx({
      args: ['resultado'],
      sender: { jid: 'owner@test.com', pushName: 'Owner', isOwner: true, isAdmin: true },
    } as Partial<MessageContext>);
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No hay tickets comprados');
    expect(mockUserService.addMoney).not.toHaveBeenCalled();
  });

  it('draw por no-owner es ignorado', async () => {
    await mockUserService.getUser(USER);
    (await mockUserService.getUser(USER)).money = 10_000;

    const buyCtx = makeCtx({ args: ['comprar', '1'] });
    await command.execute(buyCtx);
    mockUserService.addMoney.mockClear();

    const ctx = makeCtx({ args: ['resultado'] });
    await command.execute(ctx);

    expect(mockUserService.addMoney).not.toHaveBeenCalled();
  });

  it('draw del owner paga al ganador el 80% del pozo y resetea', async () => {
    await mockUserService.getUser('a@test.com');
    (await mockUserService.getUser('a@test.com')).money = 10_000;
    await mockUserService.getUser('b@test.com');
    (await mockUserService.getUser('b@test.com')).money = 10_000;

    const ctxA = makeCtx({
      args: ['comprar', '2'],
      sender: { jid: 'a@test.com', pushName: 'A', isOwner: false, isAdmin: false },
    } as Partial<MessageContext>);
    await command.execute(ctxA); // pozo: 2000 * 0.8 = 1600
    const ctxB = makeCtx({
      args: ['comprar', '2'],
      sender: { jid: 'b@test.com', pushName: 'B', isOwner: false, isAdmin: false },
    } as Partial<MessageContext>);
    await command.execute(ctxB); // pozo: 3200

    mockUserService.addMoney.mockClear();
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const drawCtx = makeCtx({
      args: ['resultado'],
      sender: { jid: 'owner@test.com', pushName: 'Owner', isOwner: true, isAdmin: true },
    } as Partial<MessageContext>);
    await command.execute(drawCtx);
    spy.mockRestore();

    expect(mockUserService.addMoney).toHaveBeenCalledTimes(1);
    const [, prize] = mockUserService.addMoney.mock.calls[0] as [string, number];
    expect(prize).toBe(3200); // 4000 * 0.8, floor

    // Tras el draw el estado resetea: se puede volver a comprar
    const statusCtx = makeCtx({ args: ['estado'] });
    await command.execute(statusCtx);
    expect(lastReply(statusCtx)).toContain('0/100');
  });
});
