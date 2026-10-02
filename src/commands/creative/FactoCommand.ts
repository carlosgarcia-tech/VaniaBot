/**
 * FactoCommand.ts
 *
 * fun command `facto` — Envía una verdad incómoda y elegante
 * Usage: !facto [tema]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { primeService } from '@/services/system/PrimeService.js';

const FACTOS_PREDEFINED = [
  'La persona que dice "no me gusta el drama" usualmente es la que lo genera.',
  'Si alguien te dice "soy muy honesto" sin que nadie lo pida, probablemente miente sobre otras cosas.',
  'La mayoría de las personas que critican a los demás lo hacen porque no tienen nada mejor que ofrecer.',
  'Decir "no soy celoso" cuando no tienes a nadie es como decir "no gasto dinero" cuando estás en quiebra.',
  'Los que siempre presumen de ser valientes usualmente son los primeros en desaparecer cuando hay problemas.',
  'La persona que pregunta "¿por qué no me hablas?" fue la que te bloqueó primero.',
  'Si alguien dice que no le importa el dinero, es porque nunca ha tenido que preocuparse por conseguirlo.',
  'La gente que presume de no dormir tiene dos cosas: insomnio o nada importante que hacer.',
  'Decir "no tengo favoritos" cuando tienes tres hijos es literalmente imposible.',
  'Los que siempre dicen "yo soy diferente" son los más predecibles del grupo.',
];

const PROMPT_BASE = `Eres Vania, una bot fascinante. Genera UN SOLO "facto" - una verdad incómoda, fría, precisa y elegante.

Un facto es:
- Una verdad incómoda pero precisa
- Con un toque de veneno elegante
- Difícil de refutar
- Sofisticado, no grosero
- Debe hacer que la persona reflexione

Ejemplos de estilo:
- "Inventar peleas es una táctica primitiva y carente de imaginación. Si alguien quiere irse, debería tener el coraje de hacerlo de forma directa y honesta, en lugar de recurrir a métodos infantiles. Pero eso requiere un nivel de madurez que no todos poseen."
- "La persona que dice 'no me gusta el drama' usualmente es la que lo genera."
- "Presumir de no necesitar a nadie cuando estás solo es como presumir de no fumar cuando simplemente no has encontrado un cigarrillo."

Genera solo el facto, sin introducción ni explicación. Sé creativo y diferente cada vez.`;

/** Command handler for `!facto`: Envía una verdad incómoda y elegante. */
export class FactoCommand extends Command {
  name = 'facto';
  description = 'Envía una verdad incómoda y elegante';
  category = CommandCategory.FUN;
  aliases = ['facts', 'facto', 'coldtruth'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!facto [tema]';
  examples = ['!facto', '!facto amigos', '!facto trabajo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const topic = args.join(' ');
    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);

    await ctx.react('💭');

    try {
      const facto = await this.generateFacto(ctx, topic);
      await ctx.reply(this.formatFactoMessage(facto, footer));
      await ctx.react('🎀');
    } catch {
      await ctx.reply(this.formatFactoMessage(this.getRandomFacto(), footer));
    }
  }

  private async generateFacto(ctx: MessageContext, topic: string): Promise<string> {
    const prompt = topic
      ? `${PROMPT_BASE}\n\nEl facto debe ser sobre el tema: "${topic}".`
      : PROMPT_BASE;

    const result = await aiService.chat(ctx.chat.jid, ctx.sender.jid, prompt, true);

    if (isRight(result)) {
      return result.right.trim();
    }

    return this.getRandomFacto();
  }

  private formatFactoMessage(facto: string, footer: string): string {
    const cleanFacto = facto.replace(/>\s*VaniaBot[💝]*\s*$/i, '').trim();
    return `┌─ ୨ৎ ──────┐
      ✿  *F A C T O*  ✿   

   ${cleanFacto}\n\n${footer}`;
  }

  private wrapText(text: string, maxLength: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  private getRandomFacto(): string {
    return FACTOS_PREDEFINED[Math.floor(Math.random() * FACTOS_PREDEFINED.length)];
  }
}
