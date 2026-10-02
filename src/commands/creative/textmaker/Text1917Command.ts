/**
 * Text1917Command.ts
 *
 * creative command `1917` — Crea un efecto de texto estilo 1917
 * Usage: !1917 <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/1917-style-text-effect-523.html';

/** Command handler for `!1917`: Crea un efecto de texto estilo 1917. */
export class Text1917Command extends Command {
  name = '1917';
  description = 'Crea un efecto de texto estilo 1917';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!1917 <texto>';
  examples = ['!1917 VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !1917 <texto>\n_Ejemplo: !1917 VaniaBot_');
      return;
    }

    await ctx.react('🎬');

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
