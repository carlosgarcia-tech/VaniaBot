/**
 * TextMatrixCommand.ts
 *
 * creative command `matrix` — Crea un efecto de texto estilo Matrix
 * Usage: !matrix <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/matrix-text-effect-154.html';

/** Command handler for `!matrix`: Crea un efecto de texto estilo Matrix. */
export class TextMatrixCommand extends Command {
  name = 'matrix';
  description = 'Crea un efecto de texto estilo Matrix';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!matrix <texto>';
  examples = ['!matrix VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !matrix <texto>\n_Ejemplo: !matrix VaniaBot_');
      return;
    }

    await ctx.react('🟢');

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
