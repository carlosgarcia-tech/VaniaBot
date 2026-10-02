/**
 * GayCanvasCommand.ts
 *
 * creative command `gay` — Calcula el porcentaje gay y genera imagen con efecto arcoíris
 * Usage: !gay [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import { contactsCache } from '@/utils/ContactsCache.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!gay`: Calcula el porcentaje gay y genera imagen con efecto arcoíris. */
export class GayCommand extends Command {
  name = 'gay';
  description = 'Calcula el porcentaje gay y genera imagen con efecto arcoíris';
  category = CommandCategory.CREATIVE;
  aliases = ['gayrate', 'gaymeter'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!gay [@usuario]';
  examples = ['!gay', '!gay @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🌈');

    const mentioned = ctx.mentionedJid;

    let imageUrl: string | null = null;
    let targetTag: string;
    let targetJid: string;

    if (mentioned) {
      targetJid = mentioned;
      targetTag = await contactsCache.getContactName(ctx, mentioned);
      try {
        const pic = await ctx.sock.profilePictureUrl(mentioned, 'image');
        imageUrl = pic ?? null;
      } catch (error) {
        logError('[GayCommand]', error);
      }
    } else {
      targetJid = ctx.sender.jid;
      targetTag = ctx.sender.pushName || (await contactsCache.getContactName(ctx, ctx.sender.jid));
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) imageUrl = await ImageHelper.getProfileImage(ctx);

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const base = targetJid
      .split('')
      .reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
    const percent = ((base % 101) + Math.floor(Math.random() * 7)) % 101;

    const messages = [
      `🌈 *${targetTag}* es ${percent}% homosexual 🏳️🌈`,
      `💖 Compatibilidad con arcoíris: ${percent}% para *${targetTag}* ✨`,
      `*${targetTag}* tiene un ${percent}% de magia under the rainbow 🌟`,
      `🏳️🌈 *${targetTag}* level: ${percent}% diva 💃`,
      `✨ El universo dice que *${targetTag}* es ${percent}% fabuloso 💅`,
      `🌈 *${targetTag}* está ${percent}% seguro de sí mismo 🎀`,
      `💅 *${targetTag}*: ${percent}% de personalidad drag 👑`,
      `🏳️🌈 *${targetTag}* brilla con ${percent}% de intensidad arcoíris ✨`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    await new CanvasBase().sendImageWithCaption(ctx, 'gay', { url: imageUrl }, message);
  }
}
