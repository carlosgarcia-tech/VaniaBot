/**
 * ConsejoCommand.ts
 *
 * fun command `consejo` — Da un consejo random
 * Usage: !consejo
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

const CONSEJOS = [
  'No te compares con otros, compara tu hoy con tu ayer',
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día',
  'Duerme bien, es la mejor inversión que puedes hacer',
  'Aprende a decir que no sin sentir culpa',
  'El dinero no compra la felicidad, pero sí tranquilidad',
];

/** Command handler for `!consejo`: Da un consejo random. */
export class ConsejoCommand extends Command {
  name = 'consejo';
  description = 'Da un consejo random';
  category = CommandCategory.FUN;
  aliases = ['tips', 'tip', 'consejos'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!consejo';
  examples = ['!consejo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💡');

    try {
      const prompt = AI_PROMPTS.CONSEJO;

      const response = await aiService.generate(prompt, 150);

      if (!isRight(response)) {
        const fallback = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];
        await ctx.reply(`💡 *Consejo del día* 💡\n\n${fallback}`);
        return;
      }

      await ctx.reply(`💡 *Consejo del día* 💡\n\n${response.right.trim()}`);
      await ctx.react('✨');
    } catch {
      const fallback = CONSEJOS[Math.floor(Math.random() * CONSEJOS.length)];
      await ctx.reply(`💡 *Consejo del día* 💡\n\n${fallback}`);
    }
  }
}
