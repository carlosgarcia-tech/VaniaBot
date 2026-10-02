/**
 * SlapCanvasCommand.ts
 *
 * creative command `slapcanvas` — Genera imagen de slap
 * Usage: !slapcanvas [@usuario]
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

/** Command handler for `!slapcanvas`: Genera imagen de slap. */
export class SlapCanvasCommand extends Command {
  name = 'slapcanvas';
  description = 'Genera imagen de slap';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!slapcanvas [@usuario]';
  examples = ['!slapcanvas', '!slapcanvas @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('👋');

    const [image1, image2] = await ImageHelper.getTwoProfileImages(ctx);
    if (!image1) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const params: Record<string, string> = { url1: image1 };
    if (image2) {
      params.url2 = image2;
    }

    await new CanvasBase().sendImage(ctx, 'slap', params);
  }
}
