/**
 * UpdateCommand.ts
 *
 * owner command `update` — Actualiza el bot desde git
 * Usage: !update
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview UpdateCommand.ts - Update the bot from git
 *
 * Pulls latest changes from git and rebuilds.
 *
 * @module commands/owner/system/UpdateCommand
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  PermissionLevel,
  CommandContext,
  type MessageContext,
} from '@/types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/utils/logger.js';

const execAsync = promisify(exec);

/** Command handler for `!update`: Actualiza el bot desde git. */
export class UpdateCommand extends Command {
  name = 'update';
  description = 'Actualiza el bot desde git';
  category = CommandCategory.OWNER;
  aliases = ['actualizar', 'gitpull'];
  usage = '!update';
  examples = ['!update'];
  permissions = { user: [PermissionLevel.OWNER] };
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📥');
    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` +
        `📥 iniciando actualización...\n` +
        `✿ verificando estado del repositorio`,
    );

    try {
      const { stdout: status } = await execAsync('git status --short --untracked-files=no');

      if (status.trim()) {
        await ctx.react('⚠️');
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` +
            `⚠️ hay cambios sin guardar\n\n` +
            `✿ guarda o haz stash antes de actualizar\n\n` +
            `\`\`\`${status.trim()}\`\`\``,
        );
        return;
      }

      await ctx.reply(`˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` + `📡 ejecutando git pull...`);

      const { stdout: pull } = await execAsync('git pull origin main', { timeout: 60_000 });

      if (pull.includes('Already up to date')) {
        await ctx.react('✅');
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ ya estás al día ✿\n\n` +
            `✅ no hay cambios nuevos en el repositorio`,
        );
        return;
      }

      await ctx.reply(`˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` + `📦 instalando dependencias...`);

      await execAsync('npm install', { timeout: 120_000 });

      await ctx.reply(`˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` + `🔨 compilando TypeScript...`);

      await execAsync('npm run build', { timeout: 120_000 });

      logger.info('[UpdateCommand] Actualización completada, reiniciando...');

      await ctx.react('✅');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ actualización completada ✿\n\n` +
          `🔄 el bot se reiniciará en 3 segundos...`,
      );

      setTimeout(() => process.exit(0), 3_000);
    } catch (error) {
      logger.error('[UpdateCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *update* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ error al actualizar ✿\n\n` +
          `❌ ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
