/**
 * BratCommand.ts
 *
 * creative command `brat` — Genera imagen estilo Brat
 * Usage: !brat <texto | @usuario>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { canvasService } from '@/services/external/CanvasService.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!brat`: Genera imagen estilo Brat. */
export class BratCommand extends Command {
  name = 'brat';
  description = 'Genera imagen estilo Brat';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!brat <texto | @usuario>';
  examples = ['!brat VaniaBot', '!brat @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const mentioned = ctx.mentionedJid;

    let text: string;

    if (mentioned) {
      text = await contactsCache.getContactName(ctx, mentioned);
    } else {
      text =
        ctx.args
          ?.filter(arg => !/^@\S+$/.test(arg))
          .join(' ')
          .trim() ?? '';
    }

    if (!text) {
      await ctx.reply('✍️ *Uso:* !brat <texto | @usuario>\n_Ejemplo: !brat VaniaBot_');
      return;
    }

    await ctx.react('🎨');

    try {
      const result = await canvasService.getResult('brat', { text });

      let stickerBuffer: Buffer;

      if (result.type === 'url') {
        stickerBuffer = await StickerHelper.imageUrlToSticker(result.url);
      } else {
        const { buffer, contentType } = result;
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        stickerBuffer = await StickerHelper.imageUrlToSticker(dataUrl);
      }

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el sticker. Intenta de nuevo.');
    }
  }
}
