/**
 * LoremFlickrCommand.ts
 *
 * anime command `loremflickr` — Gets an image from LoremFlickr
 * Usage: !loremflickr <tags>
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

/** Command handler for `!loremflickr`: Gets an image from LoremFlickr. */
export class LoremFlickrCommand extends Command {
  name = 'loremflickr';
  description = 'Obtiene una imagen de LoremFlickr';
  category = CommandCategory.ANIME;
  aliases = ['loremflickr', 'flickr'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!loremflickr <tags>';
  examples = ['!loremflickr cat', '!loremflickr dog,cat'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const tags = ctx.args?.join(',').trim() || 'random';

    await ctx.react('📷');
    try {
      const imageUrl = await deliriusService.getRandomImage(
        `loremflickr?flags=${encodeURIComponent(tags)}`,
      );
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[LoremFlickrCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
