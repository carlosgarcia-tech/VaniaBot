/**
 * BooruCommand.ts
 *
 * anime command `booru` — Generic safe image search on Danbooru by tag.
 * Usage: !booru <tag>
 *
 * SFW only: `rating:g` is appended and the NSFW tag blacklist applies before
 * the request leaves the process. Danbooru anonymous accepts 2 tags, so a
 * single user tag is allowed.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { Command } from '../Command.js';
import { booruService, isTagBlacklisted } from '@/services/external/BooruService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!booru`: Generic SFW Danbooru search. */
export class BooruCommand extends Command {
  name = 'booru';
  description = 'Busca una imagen SFW en Danbooru por tag';
  category = CommandCategory.ANIME;
  aliases = ['booru', 'boorusearch'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!booru <tag>';
  examples = ['!booru maid', '!booru megumin'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const raw = (ctx.args?.[0] ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    if (!raw) {
      await ctx.reply('✍️ *Uso:* !booru <tag>\n_Ejemplo: !booru maid_');
      return;
    }

    if (isTagBlacklisted(raw)) {
      await ctx.reply('🚫 Ese tag está bloqueado por seguridad.');
      return;
    }

    await ctx.react('🖼️');
    try {
      // danbooru anonymous: max 2 tags → user tag + rating.
      const imageUrl = await booruService.randomPost('danbooru', `${raw} rating:g`);
      await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: imageUrl } });
      await ctx.react('✅');
    } catch (error) {
      logError('[BooruCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Sin resultados (o filtrados por seguridad). Prueba otro tag.');
    }
  }
}

export const booruCommand = new BooruCommand();
