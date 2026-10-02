/**
 * JokeoverheadCommand.ts
 *
 * creative command `jokeoverhead` — Genera chiste sobre imagen
 * Usage: !jokeoverhead [@usuario]
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

/** Command handler for `!jokeoverhead`: Genera chiste sobre imagen. */
export class JokeoverheadCommand extends Command {
  name = 'jokeoverhead';
  description = 'Genera chiste sobre imagen';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!jokeoverhead [@usuario]';
  examples = ['!jokeoverhead', '!jokeoverhead @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😂');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'jokeoverhead', { url: imageUrl });
  }
}
