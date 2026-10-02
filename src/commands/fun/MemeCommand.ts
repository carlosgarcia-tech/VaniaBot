/**
 * MemeCommand.ts
 *
 * fun command `meme` — Muestra un meme o chiste de programador
 * Usage: !meme
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

const MEMES = [
  '¿Qué le dice un jaguar a otro? Jaguar you?',
  '¿Por qué el libro de matemáticas estaba triste? Porque tenía muchos problemas',
  '¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
  '¿Por qué el乒乓球 no podía dormir? Porque tenía miedo de las raquetas',
  'Un día vi a un orangután leyendo un libro. Le pregunté: "¿Qué lees?" Me dijo: "Una novela de mono"',
  '¿Qué le dijo el 0 al 8? "¡Bonito cinturón!"',
  'Mi enemigo favorito es el lunes. Siempre me cae mal',
  '¿Por qué el libro de historia estaba aburrido? Porque tenía muchos siglos sin hacer nada',
  'El chiste de los programmers está en DEBUG mode',
  '¿Qué hace una araña en el ordenador? ¡Web surfing!',
  'El que madruga... ¡pierde el sueño!',
  '¿Por qué el pan siempre está en problemas? Porque siempre le andan dessusando',
  'Mi psicólogo dice que tengo un problema con el ego. Le dije: "Yo no tengo ego, tú lo tienes"',
  '¿Qué hace un dog en una playa? ¡Perr-ito!',
  'El único animal que no puede hacer el amor con una zebra es el zebrafo. ¿Por qué? Porque no existe, ja ja',
  '¿Qué le dijo el café al azúcar? "Eres tan dulce que me muero"',
  'Le pedí prestado dinero a un amigo y me dijo que no. ¡Qué mal.amigo!',
  'El ejercicio es malo para la salud. Lo dice el gordo del sillón',
  '¿Qué hace un vampiro en Cuba? ¡Sanguche de доллар!',
  'Mi abuela aprendió a usar el celular. Ahora me llama 50 veces al día para preguntarme cómo funciona el "botón de arriba"',
  '¿Por qué los zombies no pueden comer brains? ¡Porque ya están brains!',
];

/** Command handler for `!meme`: Muestra un meme o chiste de programador. */
export class MemeCommand extends Command {
  name = 'meme';
  description = 'Muestra un meme o chiste de programador';
  category = CommandCategory.FUN;
  aliases = ['memes', 'chistesprogramador'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!meme';
  examples = ['!meme'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😂');

    const meme = MEMES[Math.floor(Math.random() * MEMES.length)];

    await ctx.reply(`🤪 *Meme del día* 🤪\n\n${meme}`);
    await ctx.react('🔥');
  }
}
