/**
 * CommandNameUniqueness.test.ts
 *
 * Duplicate guard: the CommandRegistry silently overwrites any repeated
 * `name` or alias (it only logs a warn), so a duplicate makes a command
 * unreachable at runtime.
 *
 * This test checks two layers:
 *  1. Static scan of every command file, including the dynamic ones
 *     generated from `ANIME_COMMANDS` in anime/AnimeCommand.ts.
 *  2. The real registry: full load via PluginLoader and verification that
 *     whatever actually registered has no collisions.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const COMMANDS_DIR = fileURLToPath(new URL('../../src/commands', import.meta.url));

interface ParsedCommand {
  name: string;
  aliases: string[];
  file: string;
}

function collectCommandFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectCommandFiles(fullPath, acc);
    } else if (entry.endsWith('Command.ts') || entry.endsWith('Command.js')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function relativeFile(file: string): string {
  const idx = file.indexOf('src/commands');
  return idx >= 0 ? file.slice(idx) : file;
}

function parseAliasesBlock(block: string): string[] {
  const match = /aliases\s*=\s*\[([^\]]*)\]/.exec(block);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

/**
 * Extracts commands declared as class fields:
 *   name = 'x';  aliases = ['a', 'b'];
 * In multi-command files (e.g. GroupCommand.ts), each `name = '...'` is
 * paired with the immediately following `aliases = [...]` block.
 */
function parseClassCommands(source: string, file: string): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const nameRe = /(?:^|\n)\s*name\s*=\s*'([^']+)'/g;

  const matches: { name: string; startIndex: number; endIndex: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(source)) !== null) {
    matches.push({ name: match[1], startIndex: match.index, endIndex: match.index + match[0].length });
  }

  for (let i = 0; i < matches.length; i++) {
    const chunkEnd = i + 1 < matches.length ? matches[i + 1].startIndex : source.length;
    const chunk = source.slice(matches[i].endIndex, chunkEnd);
    commands.push({ name: matches[i].name, aliases: parseAliasesBlock(chunk), file });
  }
  return commands;
}

/** Extracts the dynamic defs from `const ANIME_COMMANDS: AnimeCommandDef[] = [...]`. */
function parseAnimeDefs(source: string, file: string): ParsedCommand[] {
  const block = /const ANIME_COMMANDS:\s*AnimeCommandDef\[\]\s*=\s*\[([\s\S]*?)\n\];/.exec(source);
  if (!block) return [];
  const commands: ParsedCommand[] = [];
  const defRe = /\{\s*name:\s*'([^']+)',[\s\S]*?aliases:\s*\[([^\]]*)\]/g;
  let def: RegExpExecArray | null;
  while ((def = defRe.exec(block[1])) !== null) {
    const aliases = [...def[2].matchAll(/'([^']+)'/g)].map(m => m[1]);
    commands.push({ name: def[1], aliases, file });
  }
  return commands;
}

function buildCommandMap(): {
  byName: Map<string, ParsedCommand[]>;
  byAlias: Map<string, ParsedCommand[]>;
  total: number;
} {
  const byName = new Map<string, ParsedCommand[]>();
  const byAlias = new Map<string, ParsedCommand[]>();
  let total = 0;

  const register = (cmd: ParsedCommand) => {
    total++;
    byName.set(cmd.name, [...(byName.get(cmd.name) ?? []), cmd]);
    for (const alias of cmd.aliases) {
      byAlias.set(alias, [...(byAlias.get(alias) ?? []), cmd]);
    }
  };

  for (const file of collectCommandFiles(COMMANDS_DIR)) {
    const source = readFileSync(file, 'utf-8');
    for (const cmd of parseClassCommands(source, file)) register(cmd);
    for (const def of parseAnimeDefs(source, file)) register(def);
  }

  return { byName, byAlias, total };
}

function duplicates(map: Map<string, ParsedCommand[]>): string[] {
  const dups: string[] = [];
  for (const [key, owners] of map) {
    const files = [...new Set(owners.map(o => relativeFile(o.file)))];
    if (files.length > 1) {
      dups.push(`'${key}' declarado en:\n      ${files.join('\n      ')}`);
    }
  }
  return dups;
}

describe('Unicidad de nombres y aliases de comandos', () => {
  it('no tiene nombres de comando duplicados (escaneo estático)', () => {
    const { byName, total } = buildCommandMap();
    expect(total).toBeGreaterThan(200);
    expect(duplicates(byName)).toEqual([]);
  });

  it('no tiene aliases duplicados entre comandos distintos (escaneo estático)', () => {
    const { byAlias } = buildCommandMap();
    expect(duplicates(byAlias)).toEqual([]);
  });

  it('ningun alias NUEVO colisiona con el name de otro comando (escaneo estatico)', () => {
    // The registry resolves names and aliases into separate maps: an alias
    // matching another command's name isn't detected as a duplicate, but
    // real-time registration silently re-maps the alias and leaves the
    // documented command unreachable (real case, since fixed: HealthCommand's
    // 'ping' alias shadowing PingCommand).
    //
    // The pre-existing debt (kick, top, verdad, search, quote, backup,
    // subbots, health, votar, traducir, ...) was paid off by assigning each
    // alias to its correct command. The list must stay EMPTY: if this
    // test fails, a new collision is being introduced.
    const DEUDA_CONOCIDA = new Set<string>([]);

    const { byName, byAlias } = buildCommandMap();
    const clashes: string[] = [];
    for (const [alias, aliasOwners] of byAlias) {
      for (const nameOwner of byName.get(alias) ?? []) {
        for (const aliasOwner of aliasOwners) {
          if (aliasOwner.name === nameOwner.name) continue; // harmless self-alias
          const key = `${alias}: ${aliasOwner.name}(${relativeFile(aliasOwner.file).replace('src/commands/', '').replace('.ts', '')}) vs ${nameOwner.name}(${relativeFile(nameOwner.file).replace('src/commands/', '').replace('.ts', '')})`;
          if (!DEUDA_CONOCIDA.has(key)) {
            clashes.push(key);
          }
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('cada comando tiene un name válido y sin aliases repetidos en su propio array', () => {
    for (const file of collectCommandFiles(COMMANDS_DIR)) {
      const source = readFileSync(file, 'utf-8');
      const commands = [...parseClassCommands(source, file), ...parseAnimeDefs(source, file)];
      for (const cmd of commands) {
        const label = `${relativeFile(file)} [${cmd.name}]`;
        expect(cmd.name, `${label}: name vacío`).not.toBe('');
        // Multi-word names allowed: the pipeline resolves `!r cuadri` via
        // fullCommand (2 words max, see MainMessagePipeline.resolveAndExecute)
        expect(cmd.name, `${label}: el name debe ser minúsculas`).toBe(cmd.name.toLowerCase());
        expect(cmd.name, `${label}: el name solo puede tener [a-z0-9_ ]`).toMatch(
          /^[a-z0-9_]+( [a-z0-9_]+)?$/,
        );
        expect(
          new Set(cmd.aliases).size,
          `${label}: aliases duplicados dentro de su propio array`,
        ).toBe(cmd.aliases.length);
      }
    }
  });

  it(
    'el registro completo del PluginLoader no produce colisiones de name/alias',
    async () => {
      const { PluginLoader } = await import('../../src/core/PluginLoader');
      const loader = PluginLoader.getInstance();
      // loadCommands populates the lazy map; getAllCommands forces the load
      // of the remaining modules
      await loader.loadCommands([]);
      const commands = await loader.getAllCommands();

      // The PluginLoader swallows import errors; a failing module silently
      // drops out of the registry. A low threshold catches that degraded case.
      expect(commands.length).toBeGreaterThan(150);

      const names = new Map<string, number>();
      const aliases = new Map<string, number>();
      for (const cmd of commands) {
        names.set(cmd.name, (names.get(cmd.name) ?? 0) + 1);
        for (const alias of cmd.aliases ?? []) {
          aliases.set(alias, (aliases.get(alias) ?? 0) + 1);
        }
      }

      const dupNames = [...names.entries()].filter(([, n]) => n > 1).map(([k]) => k);
      const dupAliases = [...aliases.entries()].filter(([, n]) => n > 1).map(([k]) => k);
      expect(dupNames, 'names duplicados en el registro real').toEqual([]);
      expect(dupAliases, 'aliases duplicados en el registro real').toEqual([]);
    },
    { timeout: 120_000 },
  );
});
