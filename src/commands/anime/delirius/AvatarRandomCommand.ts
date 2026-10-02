/**
 * AvatarRandomCommand.ts
 *
 * anime command `avatarrandom` — Obtiene un avatar aleatorio con estilo
 * Usage: !avatarrandom [estilo]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!avatarrandom`: Obtiene un avatar aleatorio con estilo. */
export class AvatarRandomCommand extends Command {
  name = 'avatarrandom';
  description = 'Obtiene un avatar aleatorio con estilo';
  category = CommandCategory.ANIME;
  aliases = ['avatarrandom', 'randomavatar'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!avatarrandom [estilo]';
  examples = ['!avatarrandom', '!avatarrandom pixel'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const style = ctx.args?.join(' ').trim() || '';

    await ctx.react('🎨');
    try {
      const endpoint = style ? `avatar/${encodeURIComponent(style)}` : 'avatar';
      const imageUrl = await deliriusService.getRandomImage(endpoint);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[AvatarRandomCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener el avatar. Intenta de nuevo.');
    }
  }
}
