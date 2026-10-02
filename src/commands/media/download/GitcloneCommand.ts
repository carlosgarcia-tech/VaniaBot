/**
 * GitcloneCommand.ts
 *
 * media command `gitclone` — Clona repositorios de GitHub
 * Usage: !gitclone <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!gitclone`: Clona repositorios de GitHub. */
export class GitcloneCommand extends Command {
  name = 'gitclone';
  description = 'Clona repositorios de GitHub';
  category = CommandCategory.MEDIA;
  aliases = ['ghclone', 'gitcl'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!gitclone <url>';
  examples = ['!gitclone https://github.com/user/repo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();

    if (!url) {
      await ctx.reply(
        '✍️ *Uso:* !gitclone <url>\n_Ejemplo: !gitclone https://github.com/user/repo_',
      );
      return;
    }

    if (!url.includes('github.com')) {
      await ctx.reply('❌ Debes proporcionar una URL válida de GitHub');
      return;
    }

    await ctx.react('📦');
    await ctx.reply('📦 Procesando repositorio de GitHub...');

    try {
      const data = (await deliriusService.getJson('download', 'gitclone', { url })) as {
        result?: string;
        message?: string;
        success?: boolean;
        zip?: string;
        download?: string;
      };

      if (data?.result || data?.message) {
        await ctx.reply(data.result ?? data.message ?? '');
      } else if (data?.zip || data?.download) {
        const downloadUrl = data.zip || data.download;
        await ctx.reply(`📦 *Repositorio listo*\n\n⬇️ Descarga: ${downloadUrl}`);
      } else {
        await ctx.reply('❌ No pude clonar el repositorio. Intenta de nuevo.');
      }
    } catch (error) {
      logError('[GitcloneCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al clonar el repositorio. Intenta de nuevo.');
    }
  }
}
