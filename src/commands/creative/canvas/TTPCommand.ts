/**
 * TTPCommand.ts
 *
 * creative command `ttp` — Genera texto en imagen estilo TTP
 * Usage: !ttp <texto> [color]
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

/** Command handler for `!ttp`: Genera texto en imagen estilo TTP. */
export class TTPCommand extends Command {
  name = 'ttp';
  description = 'Genera texto en imagen estilo TTP';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!ttp <texto> [color]';
  examples = ['!ttp Hola', '!ttp Hola red'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const text = args.slice(0, -1).join(' ') || args.join(' ');
    const color = args[args.length - 1] || 'white';

    if (!text) {
      await ctx.reply('✍️ *Uso:* !ttp <texto> [color]\n_Ejemplo: !ttp Hola_');
      return;
    }

    await ctx.react('✍️');
    await new CanvasBase().sendImage(ctx, 'ttp', { text: text.substring(0, 50), color });
  }
}
