/**
 * PluginLoader.ts
 *
 * Dynamically loads command plugins from the commands directory.
 * Supports both instantiated command objects and command classes.
 * Implements lazy loading for improved performance.
 */

import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ICommand } from '@/types/index.js';
import { logger, logError } from '@/utils/logger.js';
import { PluginLoadError } from '@/utils/errors.js';
import { createCache, type LruMemoryCache } from '@/services/system/MemoryCacheService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface MaybeCommand {
  name?: unknown;
  execute?: unknown;
  prototype?: { execute?: unknown };
}

function isValidCommand(cmd: unknown): cmd is ICommand {
  if (typeof cmd !== 'object' || cmd === null) return false;
  const c = cmd as MaybeCommand;
  return typeof c.name === 'string' && c.name.length > 0 && typeof c.execute === 'function';
}

type CommandConstructor = new () => MaybeCommand;

function isCommandClass(value: unknown): value is CommandConstructor {
  return (
    typeof value === 'function' &&
    // Classes with required constructor parameters (e.g. ListaCommand)
    // cannot be instantiated without config: the loader only uses parameterless classes.
    (value as CommandConstructor).length === 0 &&
    typeof (value as CommandConstructor).prototype?.execute === 'function'
  );
}

/**
 * Dynamically loads command plugins from the filesystem.
 * Implements singleton pattern with lazy loading support for performance.
 */
export class PluginLoader {
  private static instance: PluginLoader;
  private loadedCommands: Map<string, ICommand> = new Map();
  private commandFiles: Map<string, string> = new Map();
  private lazyCache: LruMemoryCache<ICommand>;
  private lazyLoadingEnabled = true;
  private preloadCategories: Set<string> = new Set();

  private constructor() {
    this.lazyCache = createCache<ICommand>({
      maxSize: 100,
      ttl: 3600,
      cleanupInterval: 300000,
    });
  }

  /**
   * Gets the singleton instance of PluginLoader.
   *
   * @returns The PluginLoader instance.
   */
  static getInstance(): PluginLoader {
    if (!PluginLoader.instance) {
      PluginLoader.instance = new PluginLoader();
    }
    return PluginLoader.instance;
  }

  /**
   * Loads commands from the commands directory.
   *
   * @param preload - Array of category names to preload eagerly.
   * @returns A promise that resolves to an array of loaded commands.
   */
  async loadCommands(preload: string[] = []): Promise<ICommand[]> {
    const commands: ICommand[] = [];
    const commandsPath = join(__dirname, '../commands');

    logger.debug(`Searching for commands in: ${commandsPath}`);

    for (const category of preload) {
      this.preloadCategories.add(category);
    }

    if (preload.length === 0) {
      this.preloadCategories.add('admin');
      this.preloadCategories.add('owner');
      this.preloadCategories.add('utility');
      this.preloadCategories.add('creative');
    }

    try {
      await this.loadFromDirectory(commandsPath, commands);

      for (const cmd of commands) {
        this.loadedCommands.set(cmd.name, cmd);
      }

      if (commands.length > 0) {
        logger.info(`Commands loaded: ${commands.length}`);
        logger.debug(`Preloaded categories: ${[...this.preloadCategories].join(', ')}`);
      }
    } catch (error) {
      logError('PluginLoader.loadCommands', error);
    }

    return commands;
  }

  /**
   * Recursively loads commands from a directory.
   *
   * @param dir - The directory to scan.
   * @param commands - The array to push loaded commands to.
   * @param parentCategory - The parent category name (for nested directories).
   * @returns A promise that resolves when loading is complete.
   */
  private async loadFromDirectory(
    dir: string,
    commands: ICommand[],
    parentCategory?: string,
  ): Promise<void> {
    const files = await readdir(dir);

    await Promise.all(
      files.map(async file => {
        const filePath = join(dir, file);
        const fileStat = await stat(filePath);

        if (fileStat.isDirectory()) {
          const currentCategory = parentCategory || file;
          await this.loadFromDirectory(filePath, commands, currentCategory);
        } else if (file.endsWith('Command.ts') || file.endsWith('Command.js')) {
          const relativePath = filePath.replace(join(__dirname, '../commands') + '/', '');
          const category = relativePath.split('/')[0];

          if (
            this.preloadCategories.has(category) ||
            this.preloadCategories.has(parentCategory || category)
          ) {
            try {
              const loaded = await this.loadCommandFile(filePath);
              commands.push(...loaded);
            } catch (error) {
              logError('PluginLoader.loadFromDirectory', error);
            }
          } else {
            try {
              const loaded = await this.loadCommandFile(filePath);
              for (const cmd of loaded) {
                this.commandFiles.set(cmd.name, filePath);
                cmd.aliases?.forEach(alias => {
                  this.commandFiles.set(alias, filePath);
                });
              }
            } catch {
              const fileName = file.replace(/\.(ts|js)$/, '');
              this.commandFiles.set(fileName, filePath);
            }
          }
        }
      }),
    );
  }

  /**
   * Scans a directory for command files and registers them for lazy loading.
   *
   * @param dir - The directory to scan.
   * @returns A promise that resolves when scanning is complete.
   */
  private async scanDirectory(dir: string): Promise<void> {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (file.endsWith('Command.ts') || file.endsWith('Command.js')) {
          const commandName = file.replace(/\.(ts|js)$/, '');
          const filePath = join(dir, file);
          this.commandFiles.set(commandName, filePath);
        }
      }
    } catch (error) {
      logError('[PluginLoader]', error);
    }
  }

  /**
   * Gets a command by name, loading it lazily if necessary.
   *
   * @param name - The command name or alias.
   * @returns A promise that resolves to the command, or null if not found.
   */
  async getCommand(name: string): Promise<ICommand | null> {
    if (this.loadedCommands.has(name)) {
      const cmd = this.loadedCommands.get(name);
      if (cmd) return cmd;
    }

    const cached = this.lazyCache.get(name);
    if (cached) {
      return cached;
    }

    const filePath = this.commandFiles.get(name);
    if (filePath) {
      try {
        const loaded = await this.loadCommandFile(filePath);

        for (const cmd of loaded) {
          this.loadedCommands.set(cmd.name, cmd);
          this.lazyCache.set(cmd.name, cmd);
          cmd.aliases?.forEach(alias => {
            this.lazyCache.set(alias, cmd);
          });
        }

        for (const [key, path] of this.commandFiles) {
          if (path === filePath) {
            this.commandFiles.delete(key);
          }
        }

        return this.loadedCommands.get(name) ?? this.lazyCache.get(name) ?? null;
      } catch (error) {
        logError(`PluginLoader.getCommand(${name})`, error);
      }
    }

    for (const [, cmd] of this.loadedCommands.entries()) {
      if (cmd.aliases?.includes(name)) {
        return cmd;
      }
    }

    return null;
  }

  /**
   * Loads a single command file and extracts commands from it.
   *
   * @param filePath - The path to the command file.
   * @returns A promise that resolves to an array of commands.
   */
  private async loadCommandFile(filePath: string): Promise<ICommand[]> {
    const results: ICommand[] = [];

    try {
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const module: Record<string, unknown> = await import(fileUrl);
      const extracted = this.extractCommands(module, filePath);

      results.push(...extracted);
    } catch (error) {
      const pluginError = new PluginLoadError(filePath, error);
      logError('PluginLoader.loadCommandFile', pluginError);
    }

    return results;
  }

  /**
   * Extracts valid commands from a loaded module.
   *
   * @param module - The loaded module exports.
   * @param filename - The source filename (for error logging).
   * @returns An array of valid commands.
   */
  private extractCommands(module: Record<string, unknown>, filename: string): ICommand[] {
    const results: ICommand[] = [];

    for (const [, value] of Object.entries(module)) {
      if (!value) continue;

      if (typeof value === 'object' && isValidCommand(value)) {
        results.push(value);
        continue;
      }

      if (isCommandClass(value)) {
        try {
          const instance = new value();
          if (isValidCommand(instance)) {
            results.push(instance);
          }
        } catch (error) {
          logError(`[PluginLoader] ${filename}`, error);
        }
      }
    }

    return results;
  }

  /**
   * Checks if a command is available (loaded or pending lazy load).
   *
   * @param name - The command name or alias.
   * @returns True if the command exists.
   */
  hasCommand(name: string): boolean {
    return this.loadedCommands.has(name) || this.commandFiles.has(name) || this.lazyCache.has(name);
  }

  /**
   * Gets all currently loaded commands.
   *
   * @returns An array of loaded commands.
   */
  getLoadedCommands(): ICommand[] {
    return Array.from(this.loadedCommands.values());
  }

  /**
   * Gets all commands, loading lazy ones if necessary.
   *
   * @returns A promise that resolves to an array of all commands.
   */
  async getAllCommands(): Promise<ICommand[]> {
    if (this.commandFiles.size > 0) {
      const filePaths = [...new Set(this.commandFiles.values())];
      await Promise.all(
        filePaths.map(async filePath => {
          try {
            const loaded = await this.loadCommandFile(filePath);
            for (const cmd of loaded) {
              if (!this.loadedCommands.has(cmd.name)) {
                this.loadedCommands.set(cmd.name, cmd);
              }
            }
          } catch (error) {
            logError('[PluginLoader] getAllCommands', error);
          }
        }),
      );
      this.commandFiles.clear();
    }
    return Array.from(this.loadedCommands.values());
  }

  /**
   * Gets statistics about loaded and pending commands.
   *
   * @returns An object with loaded, lazy, and total counts.
   */
  getCommandCount(): { loaded: number; lazy: number; total: number } {
    return {
      loaded: this.loadedCommands.size,
      lazy: this.commandFiles.size,
      total: this.loadedCommands.size + this.commandFiles.size,
    };
  }

  /**
   * Gets detailed statistics including cache info.
   *
   * @returns An object with loaded count, lazy count, and cache stats.
   */
  getStats(): {
    loaded: number;
    lazy: number;
    cache: ReturnType<LruMemoryCache<ICommand>['getStats']>;
  } {
    return {
      loaded: this.loadedCommands.size,
      lazy: this.commandFiles.size,
      cache: this.lazyCache.getStats() as ReturnType<LruMemoryCache<ICommand>['getStats']>,
    };
  }

  /**
   * Enables lazy loading of commands.
   */
  enableLazyLoading(): void {
    this.lazyLoadingEnabled = true;
  }

  /**
   * Disables lazy loading of commands.
   */
  disableLazyLoading(): void {
    this.lazyLoadingEnabled = false;
  }

  /**
   * Adds a category to the preload set.
   *
   * @param category - The category name to preload.
   */
  preloadCategory(category: string): void {
    this.preloadCategories.add(category);
  }

  /**
   * Preloads all commands from the commands directory.
   *
   * @returns A promise that resolves when all commands are loaded.
   */
  async preloadAll(): Promise<void> {
    const commandsPath = join(__dirname, '../commands');
    const commands: ICommand[] = [];
    await this.loadFromDirectory(commandsPath, commands);

    for (const cmd of commands) {
      if (!this.loadedCommands.has(cmd.name)) {
        this.loadedCommands.set(cmd.name, cmd);
      }
    }

    this.commandFiles.clear();
    logger.info(`All commands preloaded: ${this.loadedCommands.size}`);
  }
}

export const pluginLoader = PluginLoader.getInstance();