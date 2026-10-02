/**
 * PetgifCommand.ts
 *
 * creative command `petgif` — Genera GIF de mascota
 * Usage: !petgif [@usuario] [resolucion] [retraso]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { canvasService } from '@/services/external/CanvasService.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!petgif`: Genera GIF de mascota. */
export class PetgifCommand extends Command {
  name = 'petgif';
  description = 'Genera GIF de mascota';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!petgif [@usuario] [resolucion] [retraso]';
  examples = ['!petgif', '!petgif @usuario', '!petgif 512 20'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];

    await ctx.react('🐾');

    let imageUrl: string | null = null;

    const mentioned = ctx.mentionedJid;

    if (mentioned) {
      try {
        const pic = await ctx.sock.profilePictureUrl(mentioned, 'image');
        imageUrl = pic ?? null;
      } catch {
        imageUrl = null;
      }
    }

    if (!imageUrl && args[0]?.startsWith('http')) {
      imageUrl = args[0];
    }

    if (!imageUrl) imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) imageUrl = await ImageHelper.getProfileImage(ctx);

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const numericArgs = args.filter(a => /^\d+$/.test(a));
    const resolution = numericArgs[0] || '512';
    const delay = numericArgs[1] || '20';

    try {
      const result = await canvasService.getResult('petgif', {
        url: imageUrl,
        resolution,
        delay,
      });

      let gifBuffer: Buffer;

      if (result.type === 'url') {
        const { default: axios } = await import('axios');
        const res = await axios.get(result.url, { responseType: 'arraybuffer', timeout: 30000 });
        gifBuffer = Buffer.from(res.data);
      } else {
        gifBuffer = result.buffer;
      }

      const stickerBuffer = await StickerHelper.createSticker(gifBuffer);

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch (_error) {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el petgif. Intenta de nuevo.');
    }
  }
}
