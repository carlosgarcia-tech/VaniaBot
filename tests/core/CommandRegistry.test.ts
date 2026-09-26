/**
 * CommandRegistry.test.ts
 *
 * Unit tests for the CommandRegistry class.
 * Tests command registration, alias resolution, and cooldown management.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CommandRegistry } from '../../src/core/CommandRegistry.js';
import { CommandCategory, type ICommand } from '../../src/types/index.js';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  const createMockCommand = (name: string, aliases: string[] = []): ICommand => ({
    name,
    description: `Description for ${name}`,
    category: CommandCategory.UTILITY,
    aliases,
    execute: async () => {},
  });

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register', () => {
    it('should register a command successfully', () => {
      const cmd = createMockCommand('test');
      registry.register(cmd);

      expect(registry.get('test')).toBe(cmd);
    });

    it('should register command aliases correctly', () => {
      const cmd = createMockCommand('test', ['t', 'testing']);
      registry.register(cmd);

      expect(registry.get('t')).toBe(cmd);
      expect(registry.get('testing')).toBe(cmd);
    });

    it('should allow registering multiple commands', () => {
      const cmd1 = createMockCommand('cmd1');
      const cmd2 = createMockCommand('cmd2');

      registry.register(cmd1);
      registry.register(cmd2);

      expect(registry.size).toBe(2);
    });
  });

  describe('get', () => {
    it('should return command by exact name', () => {
      const cmd = createMockCommand('ping');
      registry.register(cmd);

      expect(registry.get('ping')).toBe(cmd);
    });

    it('should return command by alias', () => {
      const cmd = createMockCommand('ping', ['p']);
      registry.register(cmd);

      expect(registry.get('p')).toBe(cmd);
    });

    it('should return undefined for non-existent command', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered commands', () => {
      registry.register(createMockCommand('cmd1'));
      registry.register(createMockCommand('cmd2'));

      const all = registry.getAll();

      expect(all).toHaveLength(2);
    });
  });

  describe('checkCooldown', () => {
    const COOLDOWN = 5000;

    it('should allow command execution on first call', () => {
      const canExecute = registry.checkCooldown('cmd', 'user1', COOLDOWN);

      expect(canExecute).toBe(true);
    });

    it('should block command execution during cooldown', () => {
      registry.checkCooldown('cmd', 'user1', COOLDOWN);
      const canExecute = registry.checkCooldown('cmd', 'user1', COOLDOWN);

      expect(canExecute).toBe(false);
    });

    it('should allow different users to execute independently', () => {
      registry.checkCooldown('cmd', 'user1', COOLDOWN);

      const canExecute = registry.checkCooldown('cmd', 'user2', COOLDOWN);

      expect(canExecute).toBe(true);
    });

    it('should allow same user to execute different commands', () => {
      registry.checkCooldown('cmd1', 'user1', COOLDOWN);

      const canExecute = registry.checkCooldown('cmd2', 'user1', COOLDOWN);

      expect(canExecute).toBe(true);
    });
  });

  describe('getCooldownRemaining', () => {
    const COOLDOWN = 5000;

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns 0 when no cooldown is active', () => {
      expect(registry.getCooldownRemaining('cmd', 'user1')).toBe(0);
    });

    it('returns the remaining time right after triggering the cooldown', () => {
      vi.useFakeTimers();
      registry.checkCooldown('cmd', 'user1', COOLDOWN);

      const remaining = registry.getCooldownRemaining('cmd', 'user1');

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(COOLDOWN);
    });

    it('decreases as time passes and reaches 0 when expired', () => {
      vi.useFakeTimers();
      registry.checkCooldown('cmd', 'user1', COOLDOWN);

      vi.advanceTimersByTime(2000);
      const afterTwoSeconds = registry.getCooldownRemaining('cmd', 'user1');
      expect(afterTwoSeconds).toBeGreaterThan(0);
      expect(afterTwoSeconds).toBeLessThanOrEqual(COOLDOWN - 2000);

      vi.advanceTimersByTime(COOLDOWN);
      expect(registry.getCooldownRemaining('cmd', 'user1')).toBe(0);
    });

    it('does not leak the duration across different users or commands', () => {
      vi.useFakeTimers();
      registry.checkCooldown('cmd', 'user1', COOLDOWN);

      expect(registry.getCooldownRemaining('cmd', 'user2')).toBe(0);
      expect(registry.getCooldownRemaining('other', 'user1')).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count after registrations', () => {
      registry.register(createMockCommand('cmd1'));
      registry.register(createMockCommand('cmd2', ['alias']));

      expect(registry.size).toBe(2);
    });
  });
});
