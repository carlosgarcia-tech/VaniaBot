/**
 * CommandRegistry.ts
 *
 * Central registry for managing bot commands and their aliases.
 * Handles command registration, retrieval, and cooldown tracking.
 */

import type { ICommand } from '@/types/index.js';
import { logger } from '@/utils/logger.js';

/**
 * Registry for managing commands and their aliases.
 * Provides thread-safe command registration, lookup, and cooldown management.
 */
export class CommandRegistry {
  private commands = new Map<string, ICommand>();
  private aliases = new Map<string, string>();
  private cooldowns = new Map<string, Map<string, number>>();
  private cooldownTimers = new Map<string, Map<string, NodeJS.Timeout>>();
  /** Duration (ms) of the active cooldown, keyed `command|user`. */
  private cooldownDurations = new Map<string, number>();

  /**
   * Registers a command in the registry.
   *
   * @param command - The command to register.
   */
  register(command: ICommand): void {
    const existing = this.commands.get(command.name);
    if (existing && existing !== command) {
      logger.warn(
        `Command name collision: '${command.name}' from ${existing.constructor?.name ?? 'unknown'} ` +
          `is being overwritten by ${command.constructor?.name ?? 'unknown'}`,
      );
    }

    this.commands.set(command.name, command);

    logger.debug(`Registering command: ${command.name}`);

    command.aliases?.forEach(alias => {
      const aliasOwner = this.aliases.get(alias);
      if (aliasOwner && aliasOwner !== command.name) {
        logger.warn(
          `Alias collision: '${alias}' currently maps to '${aliasOwner}' ` +
            `but is being remapped to '${command.name}'`,
        );
      }
      this.aliases.set(alias, command.name);
      logger.debug(`  - Alias registered: ${alias} → ${command.name}`);
    });
  }

  /**
   * Retrieves a command by name or alias.
   *
   * @param nameOrAlias - The command name or alias to look up.
   * @returns The command if found, undefined otherwise.
   */
  get(nameOrAlias: string): ICommand | undefined {
    const commandName = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(commandName);
  }

  /**
   * Gets all registered commands.
   *
   * @returns An array of all registered commands.
   */
  getAll(): ICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Checks if a user is on cooldown for a command.
   * If not on cooldown, sets a new cooldown and returns true.
   *
   * @param commandName - The name of the command.
   * @param userId - The user ID to check.
   * @param cooldownTime - The cooldown duration in milliseconds.
   * @returns True if the command can be executed, false if on cooldown.
   */
  checkCooldown(commandName: string, userId: string, cooldownTime: number): boolean {
    let timestamps = this.cooldowns.get(commandName);
    if (!timestamps) {
      timestamps = new Map();
      this.cooldowns.set(commandName, timestamps);
    }
    let timers = this.cooldownTimers.get(commandName);
    if (!timers) {
      timers = new Map();
      this.cooldownTimers.set(commandName, timers);
    }

    const now = Date.now();

    if (timestamps.has(userId)) {
      const userTimestamp = timestamps.get(userId);
      if (userTimestamp !== undefined) {
        const expirationTime = userTimestamp + cooldownTime;
        if (now < expirationTime) {
          return false;
        }
      }
    }

    const existingTimer = timers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    timestamps.set(userId, now);
    this.cooldownDurations.set(`${commandName}|${userId}`, cooldownTime);
    timers.set(
      userId,
      setTimeout(() => {
        timestamps.delete(userId);
        timers.delete(userId);
        this.cooldownDurations.delete(`${commandName}|${userId}`);
      }, cooldownTime),
    );

    return true;
  }

  /**
   * Clears all cooldowns for all commands and users.
   */
  clearCooldowns(): void {
    for (const timers of this.cooldownTimers.values()) {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    }
    this.cooldowns.clear();
    this.cooldownTimers.clear();
    this.cooldownDurations.clear();
  }

  /**
   * Gets the remaining cooldown time for a user on a specific command.
   *
   * @param commandName - The name of the command.
   * @param userId - The user ID to check.
   * @returns Milliseconds remaining until the user can execute the command again,
   * 0 when no active cooldown exists.
   */
  getCooldownRemaining(commandName: string, userId: string): number {
    const userTimestamp = this.cooldowns.get(commandName)?.get(userId);
    const duration = this.cooldownDurations.get(`${commandName}|${userId}`);
    if (userTimestamp === undefined || duration === undefined) return 0;
    const remaining = userTimestamp + duration - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Gets the total number of registered commands.
   *
   * @returns The number of registered commands.
   */
  get size(): number {
    return this.commands.size;
  }
}

export const commandRegistry = new CommandRegistry();