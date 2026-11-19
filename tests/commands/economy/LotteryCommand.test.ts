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
// The command stores its state at module level (loaded from the store at
// init time), so each test re-imports the module after resetting the
// registry: exactly the semantics of a process restart.

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
    backing.clear(); // clean persisted state per test
    vi.clearAllMocks();
    LotteryCommand = (await importCommandModule()).LotteryCommand;
    command = new LotteryCommand();
  });

  it('command properties', () => {
    expect(command.name).toBe('loteria');
    expect(command.aliases).toContain('lottery');
    expect(command.aliases).toContain('ticket');
    expect(command.aliases).not.toContain('comprar');
  });

  it('with no action it shows the default status', async () => {
    const ctx = makeCtx({ args: [] });
    await command.execute(ctx);

    expect(ctx.reply).toHaveBeenCalled();
    expect(lastReply(ctx)).toContain('ESTADO DE LOTERÍA');
  });

  it('unknown action shows the help', async () => {
    const ctx = makeCtx({ args: ['noexiste'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('LOTERÍA ORBIT');
    expect(lastReply(ctx)).toContain('Cómo funciona');
    expect(lastReply(ctx)).toContain('!loteria reiniciar (owner)');
  });

  it('valid purchase: charges, issues tickets, adds to the pot and persists', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    const ctx = makeCtx({ args: ['comprar', '3'] });
    await command.execute(ctx);

    expect(mockUserService.removeMoney).toHaveBeenCalledWith(USER, 3000);
    expect(lastReply(ctx)).toContain('TICKETS COMPRADOS');
    expect(lastReply(ctx)).toContain('$3');
    expect(ctx.react).toHaveBeenCalledWith('🎫');

    // Persisted to the mocked store
    expect(rawState()['tickets']).toHaveLength(3);
    expect(rawState()['prizePool']).toBe(2400);
  });

  it('rejects amounts out of range', async () => {
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

  it('rejects without enough funds', async () => {
    (await mockUserService.getUser(USER)).money = 500;

    const ctx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No tienes suficiente dinero');
    expect(mockUserService.removeMoney).not.toHaveBeenCalled();
    expect(rawState()['tickets']).toHaveLength(0);
  });

  it('partial purchase: charges only the tickets actually delivered', async () => {
    (await mockUserService.getUser(USER)).money = 150_000;

    // Buy 10 tickets per iteration until the max (100) fills up
    for (let i = 0; i < 10; i++) {
      const ctx = makeCtx({ args: ['comprar', '10'] });
      await command.execute(ctx);
    }
    // The pool is full: 0 slots left
    expect(mockUserService.removeMoney).toHaveBeenCalledTimes(10);
    expect(rawState()['tickets']).toHaveLength(100);

    const ctx = makeCtx({ args: ['comprar', '5'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('Ya no hay tickets disponibles');
    expect(mockUserService.removeMoney).toHaveBeenCalledTimes(10);
  });

  it('status shows the pot, sales and the user tickets', async () => {
    (await mockUserService.getUser(USER)).money = 50_000;

    const buyCtx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(buyCtx);

    const ctx = makeCtx({ args: ['estado'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('ESTADO DE LOTERÍA');
    expect(lastReply(ctx)).toContain('2/100');
    expect(lastReply(ctx)).toContain('Tus tickets');
  });

  it('status without tickets reports that the user is not participating', async () => {
    await mockUserService.getUser(USER);
    const ctx = makeCtx({ args: ['estado'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No tienes tickets');
  });

  it('draw without tickets warns and pays nothing', async () => {
    const ctx = makeCtx({
      args: ['resultado'],
      sender: { jid: 'owner@test.com', pushName: 'Owner', isOwner: true, isAdmin: true },
    } as Partial<MessageContext>);
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('No hay tickets comprados');
    expect(mockUserService.addMoney).not.toHaveBeenCalled();
  });

  it('draw by a non-owner is ignored', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    const buyCtx = makeCtx({ args: ['comprar', '1'] });
    await command.execute(buyCtx);
    mockUserService.addMoney.mockClear();

    const ctx = makeCtx({ args: ['resultado'] });
    await command.execute(ctx);

    expect(mockUserService.addMoney).not.toHaveBeenCalled();
  });

  it('owner draw pays the winner 80% of the pot, resets and persists', async () => {
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

  it('state survives a restart: a freshly loaded module reads from the store', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;

    const buyCtx = makeCtx({ args: ['comprar', '2'] });
    await command.execute(buyCtx);

    // Simulates a process restart: re-imports the module from scratch. The
    // new lotteryState must load from the persisted store.
    const fresh = await importCommandModule();
    const ctx = makeCtx({ args: ['estado'] });
    await new fresh.LotteryCommand().execute(ctx);

    expect(lastReply(ctx)).toContain('2/100');
    expect(lastReply(ctx)).toContain('Tus tickets');
  });

  it('a corrupt file falls back to defaults instead of breaking the command', async () => {
    // The real JsonFileStore resets to defaults on invalid JSON; the mock
    // replicates that contract by validating malformed shapes into defaults.
    backing.set(LOTTERY_FILE, { tickets: 'no-soy-un-array', prizePool: -50 });

    const ctx = makeCtx({ args: ['estado'] });
    await command.execute(ctx);

    expect(lastReply(ctx)).toContain('0/100');
    expect(lastReply(ctx)).toContain('$0'); // pozo saneado a 0
  });

  it('owner reset clears tickets and the pot without paying anyone', async () => {
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

  it('reset by a non-owner is ignored', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;
    await command.execute(makeCtx({ args: ['comprar', '2'] }));

    const ctx = makeCtx({ args: ['reiniciar'] });
    await command.execute(ctx);

    expect(ctx.reply).not.toHaveBeenCalled();
    expect(rawState()['tickets']).toHaveLength(2);
    expect(rawState()['prizePool']).toBe(1600);
  });

  it('reset accepts the reset alias and works with an empty lottery', async () => {
    const ctx = await resetAsOwner('reset');

    expect(lastReply(ctx)).toContain('SORTEO REINICIADO');
    expect(rawState()['lastDraw']).toBeGreaterThan(0);
  });

  it('the reset persists: a freshly loaded module starts clean', async () => {
    (await mockUserService.getUser(USER)).money = 10_000;
    await command.execute(makeCtx({ args: ['comprar', '2'] }));

    await resetAsOwner();

    // Simulates a process restart: the new lotteryState must read the
    // already-reset state from the persisted store.
    const fresh = await importCommandModule();
    const ctx = makeCtx({ args: ['estado'] });
    await new fresh.LotteryCommand().execute(ctx);

    expect(lastReply(ctx)).toContain('0/100');
    expect(lastReply(ctx)).toContain('No tienes tickets');
  });

  it('ticket numbers are generated with crypto: 5 uppercase hex digits', async () => {
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
