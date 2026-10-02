/**
 * TextLightCommand.ts
 *
 * creative command `light` — Crea un efecto de texto de luz futurista
 * Usage: !light <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html';

/** Command handler for `!light`: Crea un efecto de texto de luz futurista. */
export class TextLightCommand extends Command {
  name = 'light';
  description = 'Crea un efecto de texto de luz futurista';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!light <texto>';
  examples = ['!light VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !light <texto>\n_Ejemplo: !light VaniaBot_');
      return;
    }

    await ctx.react('✨');

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
