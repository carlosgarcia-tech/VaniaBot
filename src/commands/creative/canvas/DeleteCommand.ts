/**
 * DeleteCommand.ts
 *
 * creative command `delete` — Efecto de imagen borrosa (delete)
 * Usage: !delete [@usuario]
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

/** Command handler for `!delete`: Efecto de imagen borrosa (delete). */
export class DeleteCommand extends Command {
  name = 'delete';
  description = 'Efecto de imagen borrosa (delete)';
  category = CommandCategory.CREATIVE;
  aliases = ['blur'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!delete [@usuario]';
  examples = ['!delete', '!delete @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🔒');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    try {
      const canvasImageUrl = await new CanvasBase().getImageUrl('delete', { url: imageUrl });
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
