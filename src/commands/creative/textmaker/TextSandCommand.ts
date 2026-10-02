/**
 * TextSandCommand.ts
 *
 * creative command `sand` — Crea un efecto de texto en la arena
 * Usage: !sand <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html';

/** Command handler for `!sand`: Crea un efecto de texto en la arena. */
export class TextSandCommand extends Command {
  name = 'sand';
  description = 'Crea un efecto de texto en la arena';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!sand <texto>';
  examples = ['!sand VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !sand <texto>\n_Ejemplo: !sand VaniaBot_');
      return;
    }

    await ctx.react('🏖️');

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
