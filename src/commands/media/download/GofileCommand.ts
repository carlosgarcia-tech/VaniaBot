/**
 * GofileCommand.ts
 *
 * media command `gofile` — Sube un archivo a Gofile
 * Usage: !gofile [responder a archivo]
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

/** Command handler for `!gofile`: Sube un archivo a Gofile. */
export class GofileCommand extends Command {
  name = 'gofile';
  description = 'Sube un archivo a Gofile';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!gofile [responder a archivo]';
  examples = ['!gofile'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const documentMsg = ctx.message.message?.documentMessage;

    if (!documentMsg && !quotedMsg?.documentMessage) {
      await ctx.reply('❌ Responde a un archivo para subirlo a Gofile.');
      return;
    }

    await ctx.react('📤');

    try {
      const doc = documentMsg || quotedMsg?.documentMessage;
      if (!doc?.url) {
        await ctx.reply('❌ No pude obtener el archivo.');
        return;
      }

      const data = (await downloadService.getJson('gofile', { url: doc.url })) as {
        result?: string;
      };

      if (data?.result) {
        await ctx.reply(`📤 *Archivo subido a Gofile*\n\n🔗 ${data.result}`);
        await ctx.react('✅');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      logError('[GofileCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude subir el archivo. Intenta de nuevo.');
    }
  }
}
