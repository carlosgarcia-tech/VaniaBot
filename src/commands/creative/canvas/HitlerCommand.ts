/**
 * HitlerCommand.ts
 *
 * creative command `hitler` — Efecto estilo hitler
 * Usage: !hitler [@usuario]
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

/** Command handler for `!hitler`: Efecto estilo hitler. */
export class HitlerCommand extends Command {
  name = 'hitler';
  description = 'Efecto estilo hitler';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!hitler [@usuario]';
  examples = ['!hitler', '!hitler @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('⚫');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'hitler', { url: imageUrl });
  }
}
