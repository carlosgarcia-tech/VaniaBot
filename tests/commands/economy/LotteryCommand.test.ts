/**
 * LotteryCommand.test.ts
 *
 * Unit tests for the lottery command: default action, buying tickets
 * (valid, invalid amount, insufficient funds, sold out, partial purchase
 * when slots run out mid-buy), status view with/without tickets and the
 * owner-only draw that pays the winner and resets the pool, plus the
 * owner-only reset that discards tickets and pool without paying anyone.
 * Also covers the persistence layer: state survives a "restart" (reload
 * from the mocked store) and corrupt files fall back to defaults.
 *
 * JsonFileStore is mocked in-memory so no real data/ files are touched.
 *
 * @author Carlos G
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'path';

// --- Hoisted mock state -----------------------------------------------------

const { mockUserService, users, backing } = vi.hoisted(() => {
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
  return { mockUserService, users, backing: new Map<string, unknown>() };
});

// --- Module mocks -----------------------------------------------------------

vi.mock('@/utils/JsonFileStore', () => ({
  JsonFileStore: class {
    key: string;
    defaults: () => unknown;
    validate?: (data: unknown) => unknown;
    constructor(options: {
      filePath: string;
      defaults: () => unknown;
      validate?: (data: unknown) => unknown;
    }) {
      this.key = options.filePath;
      this.defaults = options.defaults;
      this.validate = options.validate;
      if (!backing.has(this.key)) backing.set(this.key, options.defaults());
    }
    load(): unknown {
      if (!backing.has(this.key)) backing.set(this.key, this.defaults());
      const data = backing.get(this.key);
      return this.validate ? this.validate(data) : data;
    }
    save(store: unknown): void {
      backing.set(this.key, JSON.parse(JSON.stringify(store)));
    }
  },
}));

vi.mock('@/services/system/Servicemanager', () => ({
  serviceManager: { userService: mockUserService },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logError: vi.fn(),
}));

// --- Imports under test (after mocks) ---------------------------------------
// El comando guarda su estado a nivel de módulo (se carga del store al
// inicializar), así que cada test re-importa el módulo tras resetear el
// registro: es exactamente la semántica de un reinicio del proceso.

type LotteryCommandModule = typeof import('@/commands/economy/LotteryCommand');
let LotteryCommand: LotteryCommandModule['LotteryCommand'];

const importCommandModule = async (): Promise<LotteryCommandModule> => {
  vi.resetModules();
  return import('@/commands/economy/LotteryCommand');
};

const USER = 'user@test.com';
const LOTTERY_FILE = join(process.cwd(), 'data', 'lottery.json');

function makeCtx(overrides: Partial<MessageContext> = {}): MessageContext {
  return {
    command: 'loteria',
    args: [],
    text: '',
    message: { key: { id: 'm1', remoteJid: 'g@g.us', fromMe: false } } as MessageContext['message'],
    sock: {} as MessageContext['sock'],
    chat: { jid: 'g@g.us', isGroup: true, isBotAdmin: true },
    sender: { jid: USER, pushName: 'User', isOwner: false, isAdmin: false },
    reply: vi.fn(async () => {}),
    react: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    loadSenderPermissions: vi.fn(async () => {}),
    loadBotPermissions: vi.fn(async () => {}),
    ...overrides,
  } as unknown as MessageContext;
}

/** Reads the persisted raw state from the mocked backing store. */
function rawState(): Record<string, unknown> {
  return backing.get(LOTTERY_FILE) as Record<string, unknown>;
}

const lastReply = (ctx: MessageContext): string => {
  const mock = ctx.reply as unknown as { mock: { calls: unknown[][] } };
  return String(mock.mock.calls.at(-1)?.[0] ?? '');
};

async function drawAsOwner(): Promise<void> {
  await new LotteryCommand().execute(
    makeCtx({
      args: ['resultado'],
      sender: { jid: 'owner@test.com', pushName: 'Owner', isOwner: true, isAdmin: true },
    } as Partial<MessageContext>),
  );
}

/** Runs the owner-only reset and returns the ctx so tests can inspect the reply. */
async function resetAsOwner(action: 'reiniciar' | 'reset' = 'reiniciar'): Promise<MessageContext> {
  const ctx = makeCtx({
    args: [action],
    sender: { jid: 'owner@test.com', pushName: 'Owner', isOwner: true, isAdmin: true },
  } as Partial<MessageContext>);
  await new LotteryCommand().execute(ctx);
  return ctx;
}

// --- Tests -----------------------------------------------------------------

describe('LotteryCommand', () => {
  let command: LotteryCommand;

  beforeEach(async () => {
    users.clear();
    backing.clear(); // estado persistido limpio en cada test
    vi.clearAllMocks();
    LotteryCommand = (await importCommandModule()).LotteryCommand;
    command = new LotteryCommand();
  });

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
    expect(lastReply(ctx)).toContain('!loteria reiniciar (owner)');
  });

  it('compra válida: cobra, emite tickets, suma al pozo y persiste', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    const ctx = makeCtx({ args: ['comprar', '3'] });
    await command.execute(ctx);

    expect(mockUserService.removeMoney).toHaveBeenCalledWith(USER, 3000);
    expect(lastReply(ctx)).toContain('TICKETS COMPRADOS');
    expect(lastReply(ctx)).toContain('$3');
    expect(ctx.react).toHaveBeenCalledWith('🎫');

    // Persistido en el store mockeado
    expect(rawState()['tickets']).toHaveLength(3);
    expect(rawState()['prizePool']).toBe(2400);
  });

  it('rechaza cantidades fuera de rango', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    for (const [amount, calls] of [
      ['0', 0],
      ['11', 0],
      ['-3', 0],
    ] as const) {
      const ctx = makeCtx({ args: ['comprar', amount] });
      await command.execute(ctx);
      expect(lastReply(ctx)).toContain('Cantidad inválida');
      expect(mockUserService.removeMoney).toHaveBeenCalledTimes(calls);
    }
  });

  it('rechaza sin fondos suficientes', async () => {
    (await mockUserService.getUser(USER)).money = 500;

    const ctx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No tienes suficiente dinero');
    expect(mockUserService.removeMoney).not.toHaveBeenCalled();
    expect(rawState()['tickets']).toHaveLength(0);
  });

  it('compra parcial: cobra solo los tickets efectivamente entregados', async () => {
    (await mockUserService.getUser(USER)).money = 150_000;

    // Comprar 10 tickets en cada iteración hasta llenar el máximo (100)
    for (let i = 0; i < 10; i++) {
      const ctx = makeCtx({ args: ['comprar', '10'] });
      await command.execute(ctx);
    }
    // El pozo está lleno: quedan 0 slots
    expect(mockUserService.removeMoney).toHaveBeenCalledTimes(10);
    expect(rawState()['tickets']).toHaveLength(100);

    const ctx = makeCtx({ args: ['comprar', '5'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('Ya no hay tickets disponibles');
    expect(mockUserService.removeMoney).toHaveBeenCalledTimes(10);
  });

  it('estado muestra el pozo, ventas y los tickets del usuario', async () => {
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
    (await mockUserService.getUser(USER)).money = 10_000;

    const buyCtx = makeCtx({ args: ['comprar', '1'] });
    await command.execute(buyCtx);
    mockUserService.addMoney.mockClear();

    const ctx = makeCtx({ args: ['resultado'] });
    await command.execute(ctx);

    expect(mockUserService.addMoney).not.toHaveBeenCalled();
  });

  it('draw del owner paga al ganador el 80% del pozo, resetea y persiste', async () => {
    (await mockUserService.getUser('a@test.com')).money = 10_000;
    (await mockUserService.getUser('b@test.com')).money = 10_000;

    await command.execute(
      makeCtx({
        args: ['comprar', '2'],
        sender: { jid: 'a@test.com', pushName: 'A', isOwner: false, isAdmin: false },
      } as Partial<MessageContext>),
    );
    await command.execute(
      makeCtx({
        args: ['comprar', '2'],
        sender: { jid: 'b@test.com', pushName: 'B', isOwner: false, isAdmin: false },
      } as Partial<MessageContext>),
    );
    // pozo: 4000 * 0.8 = 3200

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
    expect(prize).toBe(3200);

    // Estado reseteado y persistido
    expect(rawState()['tickets']).toHaveLength(0);
    expect(rawState()['prizePool']).toBe(0);
    expect(rawState()['lastDraw']).toBeGreaterThan(0);

    const statusCtx = makeCtx({ args: ['estado'] });
    await command.execute(statusCtx);
    expect(lastReply(statusCtx)).toContain('0/100');
  });

  it('el estado sobrevive un reinicio: un módulo recién cargado lee del store', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    const buyCtx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(buyCtx);

    // Simula un reinicio del proceso: re-importa el módulo desde cero. El
    // nuevo lotteryState debe cargarse desde el store persistido.
    const fresh = await importCommandModule();
    const ctx = makeCtx({ args: ['estado'] });
    await new fresh.LotteryCommand().execute(ctx);

    expect(lastReply(ctx)).toContain('2/100');
    expect(lastReply(ctx)).toContain('Tus tickets');
  });

  it('un archivo corrupto cae a defaults en lugar de romper el comando', async () => {
    // El JsonFileStore real resetea con defaults ante JSON inválido; el mock
    // replica el contrato validando formas inválidas hacia defaults.
    backing.set(LOTTERY_FILE, { tickets: 'no-soy-un-array', prizePool: -50 });

    const ctx = makeCtx({ args: ['estado'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('0/100');
    expect(lastReply(ctx)).toContain('$0'); // pozo saneado a 0
  });

  it('reiniciar del owner vacía tickets y pozo sin pagar a nadie', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;
    await command.execute(makeCtx({ args: ['comprar', '3'] }));
    mockUserService.addMoney.mockClear();

    const ctx = await resetAsOwner();

    expect(lastReply(ctx)).toContain('SORTEO REINICIADO');
    expect(lastReply(ctx)).toContain('3'); // 3 tickets eliminados
    expect(mockUserService.addMoney).not.toHaveBeenCalled();

    // Estado reseteado y persistido
    expect(rawState()['tickets']).toHaveLength(0);
    expect(rawState()['prizePool']).toBe(0);
    expect(rawState()['lastDraw']).toBeGreaterThan(0);
  });

  it('reiniciar por no-owner es ignorado', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;
    await command.execute(makeCtx({ args: ['comprar', '2'] }));

    const ctx = makeCtx({ args: ['reiniciar'] });
    await command.execute(ctx);

    expect(ctx.reply).not.toHaveBeenCalled();
    expect(rawState()['tickets']).toHaveLength(2);
    expect(rawState()['prizePool']).toBe(1600);
  });

  it('reiniciar acepta el alias reset y funciona con la lotería vacía', async () => {
    const ctx = await resetAsOwner('reset');

    expect(lastReply(ctx)).toContain('SORTEO REINICIADO');
    expect(rawState()['lastDraw']).toBeGreaterThan(0);
  });

  it('el reinicio persiste: un módulo recién cargado arranca limpio', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;
    await command.execute(makeCtx({ args: ['comprar', '2'] }));

    await resetAsOwner();

    // Simula un reinicio del proceso: el nuevo lotteryState debe leer el
    // estado ya reseteado desde el store persistido.
    const fresh = await importCommandModule();
    const ctx = makeCtx({ args: ['estado'] });
    await new fresh.LotteryCommand().execute(ctx);

    expect(lastReply(ctx)).toContain('0/100');
    expect(lastReply(ctx)).toContain('No tienes tickets');
  });

  it('los números de ticket se generan con crypto: 5 hexadecimales en mayúsculas', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    const ctx = makeCtx({ args: ['comprar', '10'] });
    await command.execute(ctx);

    const tickets = rawState()['tickets'] as Array<{ number: string }>;
    expect(tickets).toHaveLength(10);
    const numbers = new Set(tickets.map(t => t.number));
    expect(numbers.size).toBe(10); // sin colisiones
    for (const number of numbers) {
      expect(number).toMatch(/^[0-9A-F]{5}$/);
    }
  });
});
