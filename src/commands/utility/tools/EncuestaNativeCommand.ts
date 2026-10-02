/**
 * EncuestaNativeCommand.ts
 *
 * utility command `sondaggio` — Crea encuestas nativas de WhatsApp
 * Usage: !sondaggio "Pregunta" "Op1" "Op2" "Op3..."
 *
 * @author **Carlos G**
 */

import type { proto } from 'baileys';
import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';

/** Command handler for `!sondaggio`: Crea encuestas nativas de WhatsApp. */
export class EncuestaNativeCommand extends Command {
  name = 'sondaggio';
  description = 'Crea encuestas nativas de WhatsApp';
  category = CommandCategory.UTILITY;
  aliases = ['sondaggio', 'poll2'];
  usage = '!sondaggio "Pregunta" "Op1" "Op2" "Op3..."';
  examples = [
    '!sondaggio "¿Qué pizza preferis?" "Pepperoni" "Muzarella" "Jamón"',
    '!sondaggio "¿Color favorito?" "Rojo" "Azul" "Verde"',
  ];
  cooldown = 5000;
  contexts = [CommandContext.GROUP];

  private parseQuotedArgs(input: string): string[] {
    const result: string[] = [];
    const regex = /"([^"]+)"/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
      result.push(match[1].trim());
    }
    return result;
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.chat.isGroup) {
      await ctx.reply('❌ Las encuestas nativas solo funcionan en grupos.');
      return;
    }

    const raw = ctx.args.join(' ');
    const quoted = this.parseQuotedArgs(raw);

    if (quoted.length < 2) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *encuesta nativa — WhatsApp* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usarlo:* !sondaggio "Pregunta" "Opción1" "Opción2" ...\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!sondaggio "¿Pizza?" "Pepperoni" "Muzza" "Jamón"\n\n` +
          `💡 recuerda usar comillas para cada texto\n` +
          `♡ *nota:* máximo 5 opciones para encuestas nativas ♡`,
      );
      return;
    }

    if (quoted.length > 6) {
      await ctx.reply('❌ Máximo 5 opciones para encuestas nativas.');
      return;
    }

    const question = quoted[0];
    const options = quoted.slice(1);

    await ctx.react('📊');

    const pollMessage = (await ctx.sock.sendMessage(ctx.chat.jid, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1,
      },
    })) as proto.WebMessageInfo;

    if (pollMessage.key?.id) {
      await ctx.reply(`✅ Encuesta creada. Los miembros del grupo pueden votar directamente.`);
    }
  }
}
