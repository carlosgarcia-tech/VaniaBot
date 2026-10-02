/**
 * PersonalidadCommand.ts
 *
 * fun command `personalidad` — Analizar la personalidad de alguien
 * Usage: !personalidad <nombre>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

const pickRandom = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const PERSONAS = [
  'De buen corazón',
  'Arrogante',
  'Tacaño',
  'Generoso',
  'Humilde',
  'Tímido',
  'Cobarde',
  'Entrometido',
  'Cristal',
  'No binarie XD',
  'Pendejo',
  'Genio',
  'Loco',
  'Sabelotodo',
  'Troll',
  'Empollón',
  'Cool',
  'Edgy',
  'Normal',
];

const ACTIVITIES = [
  'Pesado',
  'De malas',
  'Distraido',
  'De molestoso',
  'Chismoso',
  'Pasa jalandosela',
  'De compras',
  'Viendo anime',
  'Chatea en WhatsApp porque está soltero',
  'Acostado bueno para nada',
  'De mujeriego',
  'En el celular',
  'Jugando videojuegos',
  'Durmiendo',
  'Comiendo',
  'Trabajando',
  'Estudiando',
  'Haciendo el heavy',
];

const GENDERS = [
  'Hombre',
  'Mujer',
  'Homosexual',
  'Bisexual',
  'Pansexual',
  'Feminista',
  'Heterosexual',
  'Macho alfa',
  'Mujerzona',
  'Marimacha',
  'Palosexual',
  'Sr. Manuela',
  'Pollosexual',
  'Demi-sexual',
  'Asexual',
  'Omni-sexual',
];

const generatePercent = (): string => {
  const options = [
    '6%',
    '12%',
    '20%',
    '27%',
    '35%',
    '41%',
    '49%',
    '54%',
    '60%',
    '66%',
    '73%',
    '78%',
    '84%',
    '92%',
    '93%',
    '94%',
    '96%',
    '98.3%',
    '99.7%',
    '99.9%',
    '1%',
    '2.9%',
    '0%',
    '0.4%',
  ];
  return pickRandom(options);
};

/** Command handler for `!personalidad`: Analizar la personalidad de alguien. */
export class PersonalidadCommand extends Command {
  name = 'personalidad';
  description = 'Analizar la personalidad de alguien';
  category = CommandCategory.FUN;
  aliases = ['personalidad'];
  usage = '!personalidad <nombre>';
  examples = ['!personalidad Juan', '!personalidad María'];
  cooldown = 10_000;

  async execute(ctx: MessageContext): Promise<void> {
    const name = ctx.args.join(' ') || ctx.sender.pushName || 'Alguien';

    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *analizando personalidad* ˚₊· ͟͟͞͞➳\n\n` +
          `Analizando la personalidad de *${name}*\n\n` +
          `✿ Usa: *!personalidad <nombre>*`,
      );
      return;
    }

    const personalidad = `╭━━〔PERSONALIDAD〕━━⬣
┃
┃ 👤 *Nombre:* ${name}
┃
┃ ⭐ *Buena Moral:* ${generatePercent()}
┃ 💀 *Mala Moral:* ${generatePercent()}
┃
┃ 🎭 *Tipo de persona:* ${pickRandom(PERSONAS)}
┃ 🔄 *Siempre:* ${pickRandom(ACTIVITIES)}
┃
┃ 🧠 *Inteligencia:* ${generatePercent()}
┃ 💸 *Morosidad:* ${generatePercent()}
┃ 😤 *Coraje:* ${generatePercent()}
┃ 😨 *Miedo:* ${generatePercent()}
┃ ⭐ *Fama:* ${generatePercent()}
┃
┃ 🎯 *Género:* ${pickRandom(GENDERS)}
┃
╰━━━━━━━━━━━━━⬣`;

    await ctx.reply(personalidad);
  }
}
