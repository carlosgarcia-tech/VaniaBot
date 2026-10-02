/**
 * ChisteCommand.ts
 *
 * fun command `chiste` — Cuenta un chiste random
 * Usage: !chiste [categoria]
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

/** Command handler for `!chiste`: Cuenta un chiste random. */
export class ChisteCommand extends Command {
  name = 'chiste';
  description = 'Cuenta un chiste random';
  category = CommandCategory.FUN;
  aliases = ['ch', 'joke', 'chistes'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!chiste [categoria]';
  examples = ['!chiste', '!chiste largo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const tipo = args[0]?.toLowerCase() === 'largo' ? 'largo' : 'corto';

    await ctx.react('😄');

    try {
      const prompt = tipo === 'largo' ? AI_PROMPTS.CHISTE_LARGO : AI_PROMPTS.CHISTE_CORTO;
      const response = await aiService.generate(prompt, 300);

      if (!isRight(response)) {
        const fallback = await fallbackAPIService.getJoke(tipo === 'largo' ? 'long' : 'short');
        await ctx.reply(`😄 *Chiste* 😄\n\n${fallback}`);
        return;
      }

      await ctx.reply(`😄 *Chiste ${tipo}* 😄\n\n${response.right.trim()}`);
      await ctx.react('😂');
    } catch {
      const fallback = await fallbackAPIService.getJoke(tipo === 'largo' ? 'long' : 'short');
      await ctx.reply(`😄 *Chiste* 😄\n\n${fallback}`);
    }
  }
}
