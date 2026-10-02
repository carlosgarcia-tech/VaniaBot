/**
 * ShitCommand.ts
 *
 * creative command `shit` — Genera imagen con mierda
 * Usage: !shit [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!shit`: Genera imagen con mierda. */
export class ShitCommand extends Command {
  name = 'shit';
  description = 'Genera imagen con mierda';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!shit [@usuario]';
  examples = ['!shit', '!shit @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💩');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'shit', { url: imageUrl });
  }
}
