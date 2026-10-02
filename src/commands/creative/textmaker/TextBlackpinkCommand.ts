/**
 * TextBlackpinkCommand.ts
 *
 * creative command `blackpink` — Crea un efecto de texto estilo Blackpink
 * Usage: !blackpink <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { TextMakerBase } from './TextMakerBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const PAGE_URL =
  'https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html';

/** Command handler for `!blackpink`: Crea un efecto de texto estilo Blackpink. */
export class TextBlackpinkCommand extends Command {
  name = 'blackpink';
  description = 'Crea un efecto de texto estilo Blackpink';
  category = CommandCategory.CREATIVE;
  aliases = ['bp'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!blackpink <texto>';
  examples = ['!blackpink VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !blackpink <texto>\n_Ejemplo: !blackpink VaniaBot_');
      return;
    }

    await ctx.react('💖');

    try {
      const base = new TextMakerBase();
      await base.sendImage(ctx, PAGE_URL, text);
      await ctx.react('✅');
    } catch (_error) {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la imagen. Intenta de nuevo.');
    }
  }
}
