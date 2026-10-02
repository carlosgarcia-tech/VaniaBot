/**
 * ImgurCommand.ts
 *
 * media command `imgur` — Sube una imagen a Imgur
 * Usage: !imgur [responder a imagen]
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

/** Command handler for `!imgur`: Sube una imagen a Imgur. */
export class ImgurCommand extends Command {
  name = 'imgur';
  description = 'Sube una imagen a Imgur';
  category = CommandCategory.MEDIA;
  aliases = [];
  cooldown = 20000;
  contexts = [CommandContext.BOTH];
  usage = '!imgur [responder a imagen]';
  examples = ['!imgur'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const quotedMsg = ctx.quoted;
    const imageMsg = ctx.message.message?.imageMessage;

    if (!imageMsg && !quotedMsg?.imageMessage) {
      await ctx.reply('❌ Responde a una imagen para subirla a Imgur.');
      return;
    }

    await ctx.react('☁️');

    try {
      const quotedImage = quotedMsg?.imageMessage;
      const directImage = imageMsg;
      const imageData = quotedImage || directImage;

      if (!imageData?.url) {
        await ctx.reply('❌ No pude obtener la imagen.');
        return;
      }

      const data = (await downloadService.getJson('imgur', { url: imageData.url })) as {
        result?: string;
      };

      if (data?.result) {
        await ctx.reply(`☁️ *Imagen subida*\n\n🔗 ${data.result}`);
        await ctx.react('✅');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      logError('[ImgurCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude subir la imagen. Intenta de nuevo.');
    }
  }
}
