/**
 * PhubCommand.ts
 *
 * creative command `phub` — Genera imagen estilo Pornhub
 * Usage: !phub <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import { uploadToTmpfiles } from '@/utils/helpers.js';
import { getContextInfo } from '@/utils/getContextInfo.js';
import { logError } from '@/utils/logger.js';
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

/** Command handler for `!phub`: Genera imagen estilo Pornhub. */
export class PhubCommand extends Command {
  name = 'phub';
  description = 'Genera imagen estilo Pornhub';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!phub <texto>';
  examples = ['!phub Mi contenido'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];
    if (args.length < 1) {
      await ctx.reply('✍️ *Uso:* !phub <texto>\n_Ejemplo: !phub Mi contenido_');
      return;
    }

    const text = args
      .filter(arg => !/^@\S+$/.test(arg))
      .join(' ')
      .trim()
      .substring(0, 30);

    if (!text) {
      await ctx.reply('✍️ *Uso:* !phub <texto>\n_Ejemplo: !phub Mi contenido_');
      return;
    }

    const msg = ctx.message.message;
    const contextInfo = getContextInfo(msg);

    const mentioned = contextInfo?.mentionedJid?.[0];
    const targetJid = mentioned ?? ctx.sender.jid;

    const username = mentioned
      ? await contactsCache.getContactName(ctx, mentioned)
      : ctx.sender.pushName || (await contactsCache.getContactName(ctx, ctx.sender.jid));

    await ctx.react('🔞');

    let imageUrl: string | null = null;
    try {
      const pic = await ctx.sock.profilePictureUrl(targetJid, 'image');
      imageUrl = pic ?? null;
    } catch (error) {
      logError('[PhubCommand]', error);
    }

    if (!imageUrl) imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) imageUrl = await getDefaultImageUrl();

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener ninguna imagen.');
      return;
    }

    try {
      const canvasImageUrl = await new CanvasBase().getImageUrl('phub', {
        image: imageUrl,
        username,
        text,
      });
      const stickerBuffer = await StickerHelper.imageUrlToSticker(canvasImageUrl);
      await ctx.sock.sendMessage(ctx.chat.jid, { sticker: stickerBuffer });
      await ctx.react('✅');
    } catch {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar el sticker. Intenta de nuevo.');
    }
  }
}
