/**
 * XnxxcardCommand.ts
 *
 * creative command `xnxxcard` — Genera tarjeta estilo XNXX
 * Usage: !xnxxcard <titulo>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import { canvasService } from '@/services/external/CanvasService.js';
import { uploadToTmpfiles } from '@/utils/helpers.js';
import { logger } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

let cachedDefaultImageUrl: string | null = null;

async function getDefaultImageUrl(): Promise<string | null> {
  if (cachedDefaultImageUrl) return cachedDefaultImageUrl;
  const buffer = findAssetFile('profileDefault.png');
  if (!buffer) return null;
  const url = await uploadToTmpfiles(buffer);
  if (url) cachedDefaultImageUrl = url;
  return url;
}

/** Command handler for `!xnxxcard`: Genera tarjeta estilo XNXX. */
export class XnxxcardCommand extends Command {
  name = 'xnxxcard';
  description = 'Genera tarjeta estilo XNXX';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!xnxxcard <titulo>';
  examples = ['!xnxxcard Mi Video'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];

    if (args.length < 1) {
      await ctx.reply('✍️ *Uso:* !xnxxcard <titulo>\n_Ejemplo: !xnxxcard Mi Video_');
      return;
    }

    const title = args
      .filter(arg => !/^@\S+$/.test(arg))
      .join(' ')
      .trim()
      .substring(0, 30);

    if (!title) {
      await ctx.reply('✍️ *Uso:* !xnxxcard <titulo>\n_Ejemplo: !xnxxcard Mi Video_');
      return;
    }

    const mentioned = ctx.mentionedJid;
    const targetJid = mentioned ?? ctx.sender.jid;

    const userTag = mentioned
      ? `@${mentioned.split('@')[0]}`
      : ctx.sender.pushName
        ? `@${ctx.sender.pushName.replace(/\s+/g, '')}`
        : `@${ctx.sender.jid.split('@')[0]}`;

    await ctx.react('🎬');

    let imageUrl: string | null = null;

    try {
      const pic = await ctx.sock.profilePictureUrl(targetJid, 'image');
      imageUrl = pic ?? null;
    } catch (e) {
      logger.info(
        '[XnxxcardCommand][execute] profilePictureUrl failed:',
        e instanceof Error ? e.message : e,
      );
    }

    if (!imageUrl) imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) imageUrl = await getDefaultImageUrl();

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener ninguna imagen para generar la tarjeta.');
      return;
    }

    try {
      const result = await canvasService.getResult('xnxxcard', {
        image: imageUrl,
        title,
        username: userTag,
      });

      const imageBuffer =
        result.type === 'url'
          ? await StickerHelper.imageUrlToSticker(result.url)
          : await StickerHelper.imageToSticker(result.buffer);

      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: imageBuffer });
      await ctx.react('✅');
    } catch (_error) {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la tarjeta. Intenta de nuevo.');
    }
  }
}
