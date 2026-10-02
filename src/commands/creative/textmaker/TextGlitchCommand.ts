/**
 * TextGlitchCommand.ts
 *
 * creative command `glitch` — Crea un efecto de texto glitch
 * Usage: !glitch <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html';

/** Command handler for `!glitch`: Crea un efecto de texto glitch. */
export class TextGlitchCommand extends Command {
  name = 'glitch';
  description = 'Crea un efecto de texto glitch';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!glitch <texto>';
  examples = ['!glitch VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !glitch <texto>\n_Ejemplo: !glitch VaniaBot_');
      return;
    }

    await ctx.react('👾');

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
