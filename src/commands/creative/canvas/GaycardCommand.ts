/**
 * GaycardCommand.ts
 *
 * creative command `gaycard` — Genera tarjeta gay
 * Usage: !gaycard [@usuario]
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

function generateRank(jid: string): string {
  const seed = jid.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const daily = Math.floor(Date.now() / 86400000);
  const base = ((seed * 31 + daily * 7) % 9) + 1;
  const jitter = Math.floor(Math.random() * 3);
  return String(Math.min(base + jitter, 10));
}

/** Command handler for `!gaycard`: Genera tarjeta gay. */
export class GaycardCommand extends Command {
  name = 'gaycard';
  description = 'Genera tarjeta gay';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!gaycard [@usuario]';
  examples = ['!gaycard', '!gaycard @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🌈');

    const mentioned = ctx.mentionedJid;

    let imageUrl: string | null = null;
    let name: string;
    let targetJid: string;

    if (mentioned) {
      targetJid = mentioned;
      name = await contactsCache.getContactName(ctx, mentioned);
      try {
        const pic = await ctx.sock.profilePictureUrl(mentioned, 'image');
        imageUrl = pic ?? null;
      } catch (error) {
        logError('[GaycardCommand]', error);
      }
    } else {
      targetJid = ctx.sender.jid;
      name = ctx.sender.pushName || (await contactsCache.getContactName(ctx, ctx.sender.jid));
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) imageUrl = await ImageHelper.getProfileImage(ctx);

    const rank = generateRank(targetJid);

    const params: Record<string, string> = {
      name: name.substring(0, 20),
      rank,
    };

    if (imageUrl) params.url = imageUrl;

    await new CanvasBase().sendImage(ctx, 'gaycard', params);
  }
}
