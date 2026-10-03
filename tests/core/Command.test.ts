/**
 * Command.test.ts
 *
 * Unit tests for the Command base class.
 * Tests permission checking, context validation, and command properties.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from '../../src/commands/Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '../../src/types/index.js';

class TestCommand extends Command {
  name = 'test';
  description = 'Test command';
  category = CommandCategory.UTILITY;
  executeCalled = false;

  async execute(ctx: MessageContext): Promise<void> {
    this.executeCalled = true;
  }

  testHasPermission(ctx: MessageContext): boolean {
    return this.hasPermission(ctx);
  }

  testValidateContext(ctx: MessageContext): boolean {
    return this.validateContext(ctx);
  }
}

describe('Command', () => {
  let command: TestCommand;
  let mockCtx: MessageContext;

  beforeEach(() => {
    command = new TestCommand();
    mockCtx = {
      command: 'test',
      args: [],
      message: {} as any,
      sock: {} as any,
      chat: { jid: 'group@test.com', isGroup: true, isBotAdmin: false } as any,
      sender: { jid: 'user@test.com', isOwner: false, isAdmin: false } as any,
      reply: vi.fn().mockResolvedValue(undefined),
      react: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessageContext;
  });

  describe('default properties', () => {
    it('should have default aliases', () => {
      expect(command.aliases).toEqual([]);
    });

    it('should have default cooldown', () => {
      expect(command.cooldown).toBe(3000);
    });

    it('should have default permissions', () => {
      expect(command.permissions?.user).toContain(PermissionLevel.USER);
    });

    it('should allow both contexts by default', () => {
      expect(command.contexts).toContain(CommandContext.BOTH);
    });
  });

  describe('custom properties', () => {
    it('should allow setting custom aliases', () => {
      const customCommand = new (class extends TestCommand {
        aliases = ['t', 'testing'];
      })();

      expect(customCommand.aliases).toEqual(['t', 'testing']);
    });

    it('should allow setting custom cooldown', () => {
      const customCommand = new (class extends TestCommand {
        cooldown = 5000;
      })();

      expect(customCommand.cooldown).toBe(5000);
    });

    it('should allow setting custom permissions', () => {
      const customCommand = new (class extends TestCommand {
        permissions = {
          user: [PermissionLevel.ADMIN],
          bot: ['admin'] as any,
        };
      })();

      expect(customCommand.permissions?.user).toContain(PermissionLevel.ADMIN);
    });
  });

  describe('hasPermission', () => {
    it('should allow user with USER permission', () => {
      mockCtx.sender.isOwner = false;
      mockCtx.sender.isAdmin = false;

      const hasPermission = command.testHasPermission(mockCtx);

      expect(hasPermission).toBe(true);
    });

    it('should allow owner for OWNER permission', () => {
      const ownerCommand = new (class extends TestCommand {
        permissions = { user: [PermissionLevel.OWNER], bot: [] };
      })();

      mockCtx.sender.isOwner = true;
      mockCtx.sender.isAdmin = false;

      const hasPermission = ownerCommand.testHasPermission(mockCtx);

      expect(hasPermission).toBe(true);
    });

    it('should deny non-owner for OWNER permission', () => {
      const ownerCommand = new (class extends TestCommand {
        permissions = { user: [PermissionLevel.OWNER], bot: [] };
      })();

      mockCtx.sender.isOwner = false;

      const hasPermission = ownerCommand.testHasPermission(mockCtx);

      expect(hasPermission).toBe(false);
    });

    it('should allow admin for ADMIN permission', () => {
      const adminCommand = new (class extends TestCommand {
        permissions = { user: [PermissionLevel.ADMIN], bot: [] };
      })();

      mockCtx.sender.isAdmin = true;

      const hasPermission = adminCommand.testHasPermission(mockCtx);

      expect(hasPermission).toBe(true);
    });

    it('should allow owner for ADMIN permission', () => {
      const adminCommand = new (class extends TestCommand {
        permissions = { user: [PermissionLevel.ADMIN], bot: [] };
      })();

      mockCtx.sender.isAdmin = false;
      mockCtx.sender.isOwner = true;

      const hasPermission = adminCommand.testHasPermission(mockCtx);

      expect(hasPermission).toBe(true);
    });
  });

  describe('validateContext', () => {
    it('should allow BOTH context in group', () => {
      const bothCommand = new (class extends TestCommand {
        contexts = [CommandContext.BOTH];
      })();

      mockCtx.chat.isGroup = true;

      expect(bothCommand.testValidateContext(mockCtx)).toBe(true);
    });

    it('should allow BOTH context in private', () => {
      const bothCommand = new (class extends TestCommand {
        contexts = [CommandContext.BOTH];
      })();

      mockCtx.chat.isGroup = false;

      expect(bothCommand.testValidateContext(mockCtx)).toBe(true);
    });

    it('should allow GROUP context in group', () => {
      const groupCommand = new (class extends TestCommand {
        contexts = [CommandContext.GROUP];
      })();

      mockCtx.chat.isGroup = true;

      expect(groupCommand.testValidateContext(mockCtx)).toBe(true);
    });

    it('should deny GROUP context in private', () => {
      const groupCommand = new (class extends TestCommand {
        contexts = [CommandContext.GROUP];
      })();

      mockCtx.chat.isGroup = false;

      expect(groupCommand.testValidateContext(mockCtx)).toBe(false);
    });

    it('should allow PRIVATE context in private chat', () => {
      const privateCommand = new (class extends TestCommand {
        contexts = [CommandContext.PRIVATE];
      })();

      mockCtx.chat.isGroup = false;

      expect(privateCommand.testValidateContext(mockCtx)).toBe(true);
    });

    it('should deny PRIVATE context in group', () => {
      const privateCommand = new (class extends TestCommand {
        contexts = [CommandContext.PRIVATE];
      })();

      mockCtx.chat.isGroup = true;

      expect(privateCommand.testValidateContext(mockCtx)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute the command', async () => {
      expect(command.executeCalled).toBe(false);

      await command.execute(mockCtx);

      expect(command.executeCalled).toBe(true);
    });
  });
});
