/**
 * PPTCommand.ts
 *
 * fun command `ppt` — Piedra, papel o tijera
 * Usage: !ppt <piedra|papel|tijera>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!ppt`: Piedra, papel o tijera. */
export class PPTCommand extends Command {
  name = 'ppt';
  description = 'Piedra, papel o tijera';
  category = CommandCategory.FUN;
  aliases = ['piedra', 'ppt'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  parallelizable = true;
  usage = '!ppt <piedra|papel|tijera>';
  examples = ['!ppt piedra', '!ppt papel'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const opciones = ['piedra', 'papel', 'tijera'];
    const eleccion = ctx.args?.[0]?.toLowerCase();

    if (!eleccion || !opciones.includes(eleccion)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *qué eliges?* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ piedra\n` +
          `✿ papel\n` +
          `✿ tijera\n\n` +
          `✩ ejemplo: *!ppt piedra* ✩`,
      );
      return;
    }

    const eleccionBot = opciones[Math.floor(Math.random() * 3)];
    const eleccionEmoji: Record<string, string> = {
      piedra: '🪨',
      papel: '📄',
      tijera: '✂️',
    };

    let resultado: string;
    let emoji: string;

    if (eleccion === eleccionBot) {
      resultado = '¡Empate! 🤝';
      emoji = '🤝';
    } else if (
      (eleccion === 'piedra' && eleccionBot === 'tijera') ||
      (eleccion === 'papel' && eleccionBot === 'piedra') ||
      (eleccion === 'tijera' && eleccionBot === 'papel')
    ) {
      resultado = '¡Ganaste! 🎉';
      emoji = '🏆';
    } else {
      resultado = '¡Perdiste! 😢';
      emoji = '💔';
    }

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *ppt* ˚₊· ͟͟͞͞➳\n\n` +
        `✿ tu: ${eleccionEmoji[eleccion]} *${eleccion}*\n` +
        `✿ yo: ${eleccionEmoji[eleccionBot]} *${eleccionBot}*\n\n` +
        `✩ *${resultado}* ✩`,
    );

    await ctx.react(emoji);
  }
}
