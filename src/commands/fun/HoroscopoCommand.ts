/**
 * HoroscopoCommand.ts
 *
 * fun command `horoscopo` — Muestra el horóscopo del día
 * Usage: !horoscopo [signo]
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

/** Command handler for `!horoscopo`: Muestra el horóscopo del día. */
export class HoroscopoCommand extends Command {
  name = 'horoscopo';
  description = 'Muestra el horóscopo del día';
  category = CommandCategory.FUN;
  aliases = ['horo', 'signo', 'zodiaco'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!horoscopo [signo]';
  examples = ['!horoscopo acuario', '!horo geminis'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  private readonly signos: Record<string, string> = {
    aries: '♈ Aries (Mar 21 - Abr 19)',
    tauro: '♉ Tauro (Abr 20 - May 20)',
    geminis: '♊ Géminis (May 21 - Jun 20)',
    cancer: '♋ Cáncer (Jun 21 - Jul 22)',
    leo: '♌ Leo (Jul 23 - Ago 22)',
    virgo: '♍ Virgo (Ago 23 - Sep 22)',
    libra: '♎ Libra (Sep 23 - Oct 22)',
    escorpio: '♏ Escorpio (Oct 23 - Nov 21)',
    sagitario: '♐ Sagitario (Nov 22 - Dic 21)',
    capricornio: '♑ Capricornio (Dic 22 - Ene 19)',
    acuario: '♒ Acuario (Ene 20 - Feb 18)',
    piscis: '♓ Piscis (Feb 19 - Mar 20)',
  };

  async execute(ctx: MessageContext): Promise<void> {
    const rawSigno = ctx.args?.[0]?.toLowerCase() ?? '';
    const safeSigno = rawSigno.replace(/[\n\r\t]/g, '').slice(0, 20);
    let signo = safeSigno;
    let esRandom = false;

    if (!safeSigno || !this.signos[safeSigno]) {
      const keys = Object.keys(this.signos);
      signo = keys[Math.floor(Math.random() * keys.length)];
      esRandom = true;
    }

    await ctx.react('🔮');

    try {
      const prompt = AI_PROMPTS.HOROSCOPO(signo);

      const response = await aiService.generate(prompt, 200);

      if (!isRight(response)) {
        await ctx.reply('No pude generar el horóscopo. Intenta de nuevo.');
        return;
      }

      const mensaje = esRandom
        ? `🔮 *Horóscopo Random* 🔮\n\n${this.signos[signo]}\n\n${response.right.trim()}`
        : `🔮 *Horóscopo de ${signo}* 🔮\n\n${this.signos[signo]}\n\n${response.right.trim()}`;

      await ctx.reply(mensaje);
      await ctx.react('✨');
    } catch {
      await ctx.reply('Ocurrió un error. Intenta de nuevo.');
    }
  }
}
