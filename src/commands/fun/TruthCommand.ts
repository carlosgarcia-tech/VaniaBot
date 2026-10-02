/**
 * TruthCommand.ts
 *
 * fun command `truth` — Obtiene una pregunta de verdad aleatoria
 * Usage: !truth
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const TRUTH_QUESTIONS = [
  '¿Cuál es tu mayor vergüenza?',
  '¿Alguna vez has mentido en tu currículum?',
  '¿Cuál es el secreto que nunca le has contado a nadie?',
  '¿Alguna vez has sido infiel?',
  '¿Cuál es la mentira más grande que has dicho?',
  '¿Has robado algo alguna vez? ¿Qué?',
  '¿Cuál es el momento más incómodo de tu vida?',
  '¿Alguna vez has fingido estar enfermo para no trabajar?',
  '¿Cuál es tu pensamiento más oscuro?',
  '¿Has revisado el celular de tu pareja?',
  '¿Alguna vez has sido rechazado/a? ¿Cómo fue?',
  '¿Cuál es tu mayor miedo?',
  '¿Alguna vez has sentimiento celos de un amigo/a?',
  '¿Cuál es la decisión que más te arrepientes?',
  '¿Has mentido a tus padres sobre algo importante?',
  '¿Alguna vez has hecho trampa en un examen?',
  '¿Cuál es tu peor hábito?',
  '¿Alguna vez has criticado a alguien a sus espaldas?',
  '¿Cuál es la cosa más勇气 que has hecho?',
  '¿Alguna vez has besado a alguien que no deberías?',
  '¿Cuál es tu mayor logro hasta ahora?',
  '¿Has tenido un sueño húmedo recientemente?',
  '¿Alguna vez has usado una foto de otra persona en tus redes?',
  '¿Cuál es la mayor tontería que has hecho por amor?',
  '¿Alguna vez le has roto el corazón a alguien?',
  '¿Cuál es la peor opinión que tienes de ti mismo/a?',
  '¿Has guardaso un secreto que te han contado?',
  '¿Alguna vez has sido hipócrita con tus amigos?',
  '¿Cuál es tu mayor regret?',
  '¿Alguna vez has deseado ser otra persona?',
  '¿Cuál es la mayor presión social que has sentido?',
  '¿Has hecho algo ilegal alguna vez?',
  '¿Alguna vez has sido discriminado/a?',
  '¿Cuál es el chisme más jugoso que sabes?',
  '¿Alguna vez has expuesto a alguien en redes sociales?',
  '¿Cuál es tu mayor inseguridad?',
  '¿Has sentido que tu mejor amigo/a te traicionó?',
  '¿Alguna vez has fakeado una sonrisa?',
  '¿Cuál es el mistake más caro que has cometido?',
  '¿Alguna vez has sentido que no vales nada?',
  '¿Cuál es la verdad que escondes de tu familia?',
];

/** Command handler for `!truth`: Obtiene una pregunta de verdad aleatoria. */
export class TruthCommand extends Command {
  name = 'truth';
  description = 'Obtiene una pregunta de verdad aleatoria';
  category = CommandCategory.FUN;
  // Sin alias 'verdad': es el name de VerdadRetoCommand (juego completo).
  aliases = ['verdad_o_reto'];
  cooldown = 8000;
  contexts = [CommandContext.BOTH];
  usage = '!truth';
  examples = ['!truth'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🎯');

    try {
      const question = TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
      const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

      await ctx.reply(`🎯 *VERDAD* 🎯\n\n${question}\n\n_para @${senderName}_ ✩`);
    } catch (error) {
      logError('[TruthCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener una pregunta. Intenta de nuevo.');
    }
  }
}
