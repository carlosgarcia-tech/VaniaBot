/**
 * RipCommand.ts
 *
 * creative command `rip` — Genera imagen RIP
 * Usage: !rip [@usuario]
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

/** Command handler for `!rip`: Genera imagen RIP. */
export class RipCommand extends Command {
  name = 'rip';
  description = 'Genera imagen RIP';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!rip [@usuario]';
  examples = ['!rip', '!rip @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🕯️');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    try {
      const canvasImageUrl = await new CanvasBase().getImageUrl('rip', { url: imageUrl });
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
