/**
 * RandomCommand.ts
 *
 * fun command `random` — Genera un número, emoji o dato aleatorio
 * Usage: !random <num|emoji|dato|coin>
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

/** Command handler for `!random`: Genera un número, emoji o dato aleatorio. */
export class RandomCommand extends Command {
  name = 'random';
  description = 'Genera un número, emoji o dato aleatorio';
  category = CommandCategory.FUN;
  aliases = ['rng', 'randoms', 'rand', 'azar'];
  cooldown = 3000;
  contexts = [CommandContext.BOTH];
  usage = '!random <num|emoji|dato|coin>';
  examples = ['!random num', '!random emoji', '!random dato'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const tipo = ctx.args?.[0]?.toLowerCase() || 'num';

    await ctx.react('🎲');

    switch (tipo) {
      case 'num': {
        const min = 1;
        const max = 100;
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        await ctx.reply(`🎲 *Número Aleatorio*\n\n🧾 Del ${min} al ${max}: *${num}*`);
        break;
      }

      case 'emoji': {
        const emojis = [
          '😀',
          '😍',
          '🥳',
          '🤩',
          '😎',
          '🥰',
          '😜',
          '🤗',
          '😇',
          '🤠',
          '🧐',
          '😺',
          '🌟',
          '🔥',
          '💯',
          '✨',
        ];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        await ctx.reply(`🎭 *Emoji Aleatorio*\n\n${emoji} ${emoji} ${emoji}\n\nRandom: ${emoji}`);
        break;
      }

      case 'dato': {
        const datos = [
          'Los delfines duermen con un ojo abierto',
          'Las hormigas no duermen nunca',
          'Un rayo es 5 veces más caliente que la superficie del sol',
          'Los pulpos tienen 3 corazones',
          'La miel nunca caduca',
          'Los oxos nacen sin rodillas',
          'El corazón de una ballena azul es del tamaño de un auto pequeño',
          'Las vacas tienen mejores amigos',
          'Los pingüinos se proponen con piedras',
          'Las nutrias se dan las manos para no separarse al dormir',
        ];
        const dato = datos[Math.floor(Math.random() * datos.length)];
        await ctx.reply(`📚 *Dato Random* 📚\n\n💡 ${dato}`);
        break;
      }

      case 'coin': {
        const cara = Math.random() > 0.5;
        await ctx.reply(`🪙 *Lanzamiento de Moneda*\n\n${cara ? '🏆 *¡Cara!*' : '🔄 *¡Sello!*'}`);
        break;
      }

      case 'color': {
        const colores = [
          '🔴 Rojo',
          '🟠 Naranja',
          '🟡 Amarillo',
          '🟢 Verde',
          '🔵 Azul',
          '🟣 Morado',
          '⚫ Negro',
          '⚪ Blanco',
          '🩷 Rosa',
          '🩵 Cyan',
        ];
        const color = colores[Math.floor(Math.random() * colores.length)];
        await ctx.reply(`🎨 *Color Aleatorio*\n\n${color}`);
        break;
      }

      default:
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *oops, ese no está en mi lista* ˚₊· ͟͟͞͞➳\n\n` +
            `✿ *mis tipos:*\n\n` +
            `﹒num — número del 1 al 100\n` +
            `﹒emoji — emoji random\n` +
            `﹒dato — dato curioso\n` +
            `﹒coin — cara o sello\n` +
            `﹒color — color random`,
        );
    }
  }
}
