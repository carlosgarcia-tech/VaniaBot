/**
 * PastebinCommand.ts
 *
 * media command `pastebin` — Crea un Pastebin con texto
 * Usage: !pastebin <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { downloadService } from '@/services/external/DownloadService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!pastebin`: Crea un Pastebin con texto. */
export class PastebinCommand extends Command {
  name = 'pastebin';
  description = 'Crea un Pastebin con texto';
  category = CommandCategory.MEDIA;
  aliases = ['paste'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!pastebin <texto>';
  examples = ['!pastebin Hola mundo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !pastebin <texto>\n_Ejemplo: !pastebin Hola mundo_');
      return;
    }

    await ctx.react('📋');

    try {
      const data = (await downloadService.getJson('pastebin', { url: text })) as {
        result?: string;
      };

      if (data?.result) {
        await ctx.reply(`📋 *Pastebin creado*\n\n🔗 ${data.result}`);
        await ctx.react('✅');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      logError('[PastebinCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude crear el Pastebin. Intenta de nuevo.');
    }
  }
}
