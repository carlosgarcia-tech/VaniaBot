/**
 * TextImpressiveCommand.ts
 *
 * creative command `impressive` — Crea un efecto de texto impresionante en 3D
 * Usage: !impressive <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html';

/** Command handler for `!impressive`: Crea un efecto de texto impresionante en 3D. */
export class TextImpressiveCommand extends Command {
  name = 'impressive';
  description = 'Crea un efecto de texto impresionante en 3D';
  category = CommandCategory.CREATIVE;
  aliases = ['3d'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!impressive <texto>';
  examples = ['!impressive VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !impressive <texto>\n_Ejemplo: !impressive VaniaBot_');
      return;
    }

    await ctx.react('🎨');

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
