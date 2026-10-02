/**
 * PokeviewCommand.ts
 *
 * creative command `pokeview` — Genera vista de Pokemon
 * Usage: !pokeview <pokemon> [vista]
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

/** Command handler for `!pokeview`: Genera vista de Pokemon. */
export class PokeviewCommand extends Command {
  name = 'pokeview';
  description = 'Genera vista de Pokemon';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!pokeview <pokemon> [vista]';
  examples = ['!pokeview pikachu front', '!pokeview charizard back'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];
    if (args.length < 1) {
      await ctx.reply('✍️ *Uso:* !pokeview <pokemon> [vista]\n_Ejemplo: !pokeview pikachu front_');
      return;
    }

    const query = args[0];
    const view = args[1] || 'front';

    await ctx.react('🎮');
    await new CanvasBase().sendImage(ctx, 'pokeview', {
      query,
      view,
    });
  }
}
