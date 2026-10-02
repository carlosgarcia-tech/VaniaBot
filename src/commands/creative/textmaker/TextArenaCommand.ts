/**
 * TextArenaCommand.ts
 *
 * creative command `arena` — Crea un efecto de texto estilo Arena of Valor
 * Usage: !arena <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html';

/** Command handler for `!arena`: Crea un efecto de texto estilo Arena of Valor. */
export class TextArenaCommand extends Command {
  name = 'arena';
  description = 'Crea un efecto de texto estilo Arena of Valor';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!arena <texto>';
  examples = ['!arena VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !arena <texto>\n_Ejemplo: !arena VaniaBot_');
      return;
    }

    await ctx.react('⚔️');

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
