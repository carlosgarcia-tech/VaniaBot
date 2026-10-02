/**
 * AnimeCommand.ts
 *
 * fun command `anime` — Recomienda un anime
 * Usage: !anime [género]
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

/** Command handler for `!anime`: Recomienda un anime. */
export class AnimeCommand extends Command {
  name = 'anime';
  description = 'Recomienda un anime';
  category = CommandCategory.FUN;
  aliases = ['animerec', 'animes', 'animu'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!anime [género]';
  examples = ['!anime', '!anime acción', '!anime romance'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const rawGenero = ctx.args?.join(' ') ?? '';
    const safeGenero = rawGenero.replace(/[\n\r\t]/g, '').slice(0, 100);

    await ctx.react('🎌');

    try {
      const prompt = AI_PROMPTS.ANIME(safeGenero);
      const response = await aiService.generate(prompt, 200);

      if (!isRight(response)) {
        const fallback = await fallbackAPIService.getAnimeRecommendation(safeGenero);
        await ctx.reply(`🎌 *Recomendación Random* 🎌\n\n${fallback}`);
        return;
      }

      await ctx.reply(`🎌 *Recomendación de Anime* 🎌\n\n${response.right.trim()}`);
      await ctx.react('✨');
    } catch {
      const fallback = await fallbackAPIService.getAnimeRecommendation(safeGenero);
      await ctx.reply(`🎌 *Recomendación Random* 🎌\n\n${fallback}`);
    }
  }
}
