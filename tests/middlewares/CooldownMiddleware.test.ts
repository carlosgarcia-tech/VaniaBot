/**
 * CooldownMiddleware.test.ts
 *
 * Unit tests for the CooldownMiddleware: first use passes, blocked uses
 * reply with the *remaining* cooldown seconds (not the total), and the
 * displayed wait time decreases as the cooldown elapses.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CooldownMiddleware } from '../../src/middlewares/CooldownMiddleware.js';
import { CommandRegistry } from '../../src/core/CommandRegistry.js';
import { CommandCategory, type MessageContext, type ICommand } from '../../src/types/index.js';

const COOLDOWN_MS = 10000;

function createCommand(): ICommand {
  return {
    name: 'ping',
    description: 'test command',
    category: CommandCategory.UTILITY,
    cooldown: COOLDOWN_MS,
    execute: async () => {},
  };
}

function createCtx(): MessageContext {
  return {
    command: 'ping',
    args: [],
    message: {} as any,
    sock: {} as any,
    chat: { jid: 'user@s.whatsapp.net', isGroup: false, isBotAdmin: false },
    sender: { jid: 'user@test.com', isOwner: false, isAdmin: false },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    text: '',
  } as unknown as MessageContext;
}

describe('CooldownMiddleware', () => {
  let registry: CommandRegistry;
  let middleware: CooldownMiddleware;
  let ctx: MessageContext;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new CommandRegistry();
    registry.register(createCommand());
    middleware = new CooldownMiddleware(registry);
    ctx = createCtx();
    mockNext = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through when no cooldown is active', async () => {
    await middleware.execute(ctx, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('replies with the remaining time when blocked, not the total', async () => {
    await middleware.execute(ctx, mockNext); // triggers the cooldown

    // Advance most of the cooldown: total is 10s, 8s already elapsed.
    vi.advanceTimersByTime(8000);

    const secondCtx = createCtx();
    const secondNext = vi.fn().mockResolvedValue(undefined);
    await middleware.execute(secondCtx, secondNext);

    expect(secondNext).not.toHaveBeenCalled();
    expect(secondCtx.reply).toHaveBeenCalledWith(
      expect.stringMatching(/Espera 2s/), // real remaining: 2s, not 10s
    );
  });

  it('always shows at least 1s even right after being blocked', async () => {
    await middleware.execute(ctx, mockNext);

    const secondCtx = createCtx();
    const secondNext = vi.fn().mockResolvedValue(undefined);
    await middleware.execute(secondCtx, secondNext);

    const message = vi.mocked(secondCtx.reply).mock.calls[0]?.[0] as string;
    expect(message).toMatch(/Espera \d+s/);
    expect(message).not.toMatch(/Espera 0s/);
  });

  it('allows the command again once the cooldown has elapsed', async () => {
    await middleware.execute(ctx, mockNext);
    vi.advanceTimersByTime(COOLDOWN_MS + 1);

    const secondCtx = createCtx();
    const secondNext = vi.fn().mockResolvedValue(undefined);
    await middleware.execute(secondCtx, secondNext);

    expect(secondNext).toHaveBeenCalled();
    expect(secondCtx.reply).not.toHaveBeenCalled();
  });

  it('passes through when the command does not exist in the registry', async () => {
    ctx.command = 'nonexistent';
    await middleware.execute(ctx, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
