/**
 * QuoteCommand.ts
 *
 * creative command `quote` — Genera imagen de cita famosa
 * Usage: !quote <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!quote`: Genera imagen de cita famosa. */
export class QuoteCommand extends Command {
  name = 'quote';
  description = 'Genera imagen de cita famosa';
  category = CommandCategory.CREATIVE;
  aliases = ['citations'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!quote <texto>';
  examples = ['!quote La vida es bella'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !quote <texto>\n_Ejemplo: !quote La vida es bella_');
      return;
    }

    await ctx.react('💬');
    await new CanvasBase().sendImage(ctx, 'quote', {
      image: 'https://i.imgur.com/bcQmM4S.jpeg',
      text: text.substring(0, 100),
      footer: 'VaniaBot',
    });
  }
}
