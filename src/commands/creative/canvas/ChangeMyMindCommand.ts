/**
 * ChangeMyMindCommand.ts
 *
 * creative command `changemymind` — Genera imagen "Change My Mind"
 * Usage: !changemymind <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!changemymind`: Genera imagen "Change My Mind". */
export class ChangeMyMindCommand extends Command {
  name = 'changemymind';
  description = 'Genera imagen "Change My Mind"';
  category = CommandCategory.CREATIVE;
  aliases = ['cmm'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!changemymind <texto>';
  examples = ['!changemymind El cielo es azul'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !changemymind <texto>\n_Ejemplo: !changemymind El cielo es azul_');
      return;
    }

    await ctx.react('💭');

    try {
      const imageUrl = await new CanvasBase().getImageUrl('changemymind', {
        text: text.substring(0, 50),
      });
      const stickerBuffer = await StickerHelper.imageUrlToSticker(imageUrl);

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
