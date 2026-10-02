/**
 * FormarParejaCommand.ts
 *
 * fun command `formarpareja` — Formar 5 parejas random del grupo
 * Usage: !formarpareja
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

const R = Math.random;
const Fl = Math.floor;

/** Command handler for `!formarpareja`: Formar 5 parejas random del grupo. */
export class FormarParejaCommand extends Command {
  name = 'formarpareja';
  description = 'Formar 5 parejas random del grupo';
  category = CommandCategory.FUN;
  aliases = ['formarpareja5', 'parejas'];
  usage = '!formarpareja';
  examples = ['!formarpareja'];
  cooldown = 15_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participants = groupMeta.participants.map(p => p.id);

      if (participants.length < 10) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *no hay suficientes* ˚₊· ͟͟͞͞➳\n\n` +
            `❌ Se necesitan al menos 10 miembros en el grupo para formar parejas.`,
        );
        return;
      }

      const pickRandom = (arr: string[]): string => arr[Fl(R() * arr.length)];

      const couples: [string, string][] = [];

      for (let i = 0; i < 5; i++) {
        let p1: string, p2: string;
        do {
          p1 = pickRandom(participants);
          p2 = pickRandom(participants);
        } while (
          p1 === p2 ||
          couples.some(([a, b]) => a === p1 || a === p2 || b === p1 || b === p2)
        );

        couples.push([p1, p2]);
      }

      const messages = [
        'Esta pareja está destinada a estar juntas 💙',
        'Son dos pequeños tortolitos enamorados ✨',
        'Ya hasta familia deberían tener 🤱🧑‍🍼',
        'Ya se casaron en secreto 💍',
        'Se están dando su luna de miel ✨🥵😍❤️',
      ];

      const result = `╭━━━〔 💕 PAREJAS 〕━━━⬣
┃
┃ 😍 *Las 5 mejores parejas del grupo:*
┃
${couples
  .map(
    ([p1, p2], i) =>
      `┃ ${i + 1}. @${p1.split('@')[0]} 💕 @${p2.split('@')[0]}
┃    ${messages[i]}`,
  )
  .join('\n\n')}
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

      await ctx.sock.sendMessage(ctx.chat.jid, {
        text: result,
        mentions: couples.flat(),
      });
    } catch (error) {
      logError('[FormarParejaCommand] Error:', error);
      await ctx.reply(`˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` + `❌ Ocurrió un error al formar las parejas.`);
    }
  }
}
