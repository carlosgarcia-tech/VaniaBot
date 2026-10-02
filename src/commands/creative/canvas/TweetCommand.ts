/**
 * TweetCommand.ts
 *
 * creative command `tweet` — Genera imagen de tweet
 * Usage: !tweet <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!tweet`: Genera imagen de tweet. */
export class TweetCommand extends Command {
  name = 'tweet';
  description = 'Genera imagen de tweet';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!tweet <texto>';
  examples = ['!tweet Hola mundo', '!tweet "Mi tweet con espacios"'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !tweet <texto>\n_Ejemplo: !tweet Hola mundo_');
      return;
    }

    await ctx.react('🐦');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    const username = ctx.sender.pushName || 'User';
    const handle = username.replace(/\s+/g, '').toLowerCase().substring(0, 15);

    try {
      const canvasImageUrl = await new CanvasBase().getImageUrl('tweet', {
        name: username.substring(0, 20),
        username: `@${handle}`,
        comment: text.substring(0, 100),
        image: imageUrl || '',
        theme: 'dark',
      });

      const stickerBuffer = await StickerHelper.imageUrlToSticker(canvasImageUrl);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        sticker: stickerBuffer,
      });
      await ctx.react('✅');
    } catch (_error) {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el sticker. Intenta de nuevo.');
    }
  }
}
