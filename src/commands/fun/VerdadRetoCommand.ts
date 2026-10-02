/**
 * VerdadRetoCommand.ts
 *
 * fun command `verdad` — Juego de verdad o reto
 * Usage: !verdad [numero]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import { AI_PROMPTS } from '@/config/ai-prompts.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!verdad`: Juego de verdad o reto. */
export class VerdadRetoCommand extends Command {
  name = 'verdad';
  description = 'Juego de verdad o reto';
  category = CommandCategory.FUN;
  aliases = ['verdadoreto', 'vrd', 'reto'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!verdad [numero]';
  examples = ['!verdad', '!verdad 5'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const cantidad = Math.min(parseInt(args[0]) || 1, 5);

    await ctx.react('🎯');

    try {
      const prompt = AI_PROMPTS.VERDAD_O_RETO(cantidad);

      const response = await aiService.generate(prompt, 500);

      if (!isRight(response)) {
        await ctx.reply('No pude generar los retos. Intenta de nuevo.');
        return;
      }

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *verdad o reto* ˚₊· ͟͟͞͞➳\n\n` +
          `${response.right.trim()}\n\n` +
          `✩ _para @${ctx.sender.pushName || 'ti'}_ ✩`,
      );

      await ctx.react('🎲');
    } catch {
      await ctx.reply('Ocurrió un error. Intenta de nuevo.');
    }
  }
}
