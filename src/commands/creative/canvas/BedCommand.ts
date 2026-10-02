/**
 * BedCommand.ts
 *
 * creative command `bed` — Genera imagen en la cama
 * Usage: !bed [@usuario]
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

/** Command handler for `!bed`: Genera imagen en la cama. */
export class BedCommand extends Command {
  name = 'bed';
  description = 'Genera imagen en la cama';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!bed [@usuario]';
  examples = ['!bed', '!bed @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🛏️');

    const [image1, image2] = await ImageHelper.getTwoProfileImages(ctx);
    if (!image1) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const params: Record<string, string> = { url1: image1 };
    if (image2) {
      params.url2 = image2;
    }

    await new CanvasBase().sendImage(ctx, 'bed', params);
  }
}
