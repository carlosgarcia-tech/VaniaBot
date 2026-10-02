/**
 * TextNeonCommand.ts
 *
 * creative command `neon` — Crea un efecto de texto neon
 * Usage: !neon <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html';

/** Command handler for `!neon`: Crea un efecto de texto neon. */
export class TextNeonCommand extends Command {
  name = 'neon';
  description = 'Crea un efecto de texto neon';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!neon <texto>';
  examples = ['!neon VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !neon <texto>\n_Ejemplo: !neon VaniaBot_');
      return;
    }

    await ctx.react('💚');

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
