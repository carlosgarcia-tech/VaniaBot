/**
 * PeliculaCommand.ts
 *
 * fun command `pelicula` — Recomienda una película
 * Usage: !pelicula [género]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import { AI_PROMPTS } from '@/config/ai-prompts.js';
import { fallbackAPIService } from '@/services/external/FallbackAPIService.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!pelicula`: Recomienda una película. */
export class PeliculaCommand extends Command {
  name = 'pelicula';
  description = 'Recomienda una película';
  category = CommandCategory.FUN;
  aliases = ['pelirecomend', 'pelis', 'cine'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!pelicula [género]';
  examples = ['!pelicula', '!pelicula acción', '!pelicula comedia'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const rawGenero = ctx.args?.join(' ') ?? '';
    const safeGenero = rawGenero.replace(/[\n\r\t]/g, '').slice(0, 100);

    await ctx.react('🎬');

    try {
      const prompt = AI_PROMPTS.PELICULA(safeGenero);
      const response = await aiService.generate(prompt, 200);

      if (!isRight(response)) {
        const fallback = await fallbackAPIService.getMovieRecommendation(safeGenero);
        await ctx.reply(`🎬 *Recomendación Random* 🎬\n\n${fallback}`);
        return;
      }

      await ctx.reply(`🎬 *Recomendación de Película* 🎬\n\n${response.right.trim()}`);
      await ctx.react('🍿');
    } catch {
      const fallback = await fallbackAPIService.getMovieRecommendation(safeGenero);
      await ctx.reply(`🎬 *Recomendación Random* 🎬\n\n${fallback}`);
    }
  }
}
