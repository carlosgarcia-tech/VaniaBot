import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

export class LogsCommand extends Command {
  name = 'logs';
  description = 'Ver los últimos logs del bot';
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER] };
  aliases = ['log', 'registro'];
  usage = '!logs [número]';
  examples = ['!logs', '!logs 50'];
  cooldown = 30000;
  contexts = [CommandContext.PRIVATE];

  private readonly LOG_DIR = './logs';
  private readonly DEFAULT_LINES = 30;

  async execute(ctx: MessageContext): Promise<void> {
    const linesArg = ctx.args[0];
    const lines = linesArg ? parseInt(linesArg) : this.DEFAULT_LINES;

    if (isNaN(lines) || lines < 5 || lines > 100) {
      await ctx.reply(`❌ Número inválido. Usa entre 5 y 100 líneas.`);
      return;
    }

    await ctx.react('📋');
    await ctx.reply('🔄 Obteniendo logs...');

    try {
      if (!existsSync(this.LOG_DIR)) {
        await ctx.reply('❌ No hay directorio de logs configurado.');
        return;
      }

      const files = readdirSync(this.LOG_DIR)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          mtime: statSync(join(this.LOG_DIR, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      if (files.length === 0) {
        await ctx.reply('❌ No hay archivos de log.');
        return;
      }

      const latestLog = join(this.LOG_DIR, files[0].name);
      const content = readFileSync(latestLog, 'utf-8');
      const logLines = content
        .split('\n')
        .filter(l => l.trim())
        .slice(-lines);
      const logText = logLines.join('\n');

      if (logText.length > 6000) {
        const truncated = logText.slice(-6000);
        const firstCut = truncated.indexOf('\n');
        const display = firstCut > 0 ? truncated.slice(firstCut + 1) : truncated;

        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *logs de ${files[0].name}* ˚₊· ͟͟͞͞➳\n` +
            `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
            `✩ *te muestro las últimas ${lines} líneas* ✩\n\n` +
            '```\n' +
            display +
            '\n```',
        );
      } else {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *logs de ${files[0].name}* ˚₊· ͟͟͞͞➳\n` +
            `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
            `✩ *últimas ${lines} líneas* ✩\n\n` +
            '```\n' +
            logText +
            '\n```',
        );
      }
    } catch (error) {
      await ctx.reply(
        `❌ Error al leer logs: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }
}
