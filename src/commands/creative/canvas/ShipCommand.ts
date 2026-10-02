/**
 * ShipCommand.ts
 *
 * creative command `shipsrc` — Genera imagen de ship
 * Usage: !ship [nombre1] [nombre2] [%] [texto]
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

/** Command handler for `!shipsrc`: Genera imagen de ship. */
export class ShipCommand extends Command {
  name = 'shipsrc';
  description = 'Genera imagen de ship';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!ship [nombre1] [nombre2] [%] [texto]';
  examples = ['!ship Juan Maria', '!ship Juan Maria 80 "Love"'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💕');

    const [image1, image2] = await ImageHelper.getTwoProfileImages(ctx);

    const args = ctx.args || [];
    const name1 = args[0] || 'User 1';
    const name2 = args[1] || 'User 2';
    const percentage = args[2] || '50';
    const text = args[3] || 'Love';

    const params: Record<string, string> = {
      name1: name1.substring(0, 15),
      name2: name2.substring(0, 15),
      percentage,
      text,
    };

    if (image1) params.image1 = image1;
    if (image2) params.image2 = image2;

    await new CanvasBase().sendImage(ctx, 'ship', params);
  }
}
