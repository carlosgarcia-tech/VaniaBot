/**
 * FlirtCommand.ts
 *
 * fun command `flirt` — Envía una frase coqueta aleatoria
 * Usage: !flirt [@usuario]
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

const FLIRT_API_KEY = process.env.FLIRT_API_KEY || 'shizo';

/** Command handler for `!flirt`: Envía una frase coqueta aleatoria. */
export class FlirtCommand extends Command {
  name = 'flirt';
  description = 'Envía una frase coqueta aleatoria';
  category = CommandCategory.FUN;
  aliases = ['pickup', 'pickupline', 'coquetear', 'frasecoqueta'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!flirt [@usuario]';
  examples = ['!flirt', '!flirt @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💕');

    try {
      const response = await fetch(`https://api.shizo.top/quote/flirt?apikey=${FLIRT_API_KEY}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API_ERROR:${response.status}`);
      }

      const data = (await response.json()) as {
        status: boolean;
        result?: string;
        error?: string;
      };

      if (!data.status || !data.result) {
        throw new Error(data.error || 'Invalid API response');
      }

      const mentionedJid = ctx.mentionedJid;
      const quotedSender = ctx.contextInfo?.quotedMessage ? ctx.quotedParticipant : null;

      const targetJid = mentionedJid || quotedSender;
      const senderName = ctx.sender.pushName || ctx.sender.jid.split('@')[0];

      let message = data.result;

      if (targetJid) {
        const targetName = targetJid.split('@')[0];
        message = `*${senderName}* le dice a *@${targetName}:*\n\n💖 ${data.result}`;
        await ctx.sock.sendMessage(ctx.chat.jid, {
          text: message,
          mentions: [targetJid],
        });
      } else {
        await ctx.reply(`*${senderName}* dice:\n\n💖 ${data.result}`);
      }

      await ctx.react('💖');
    } catch (error) {
      logError('[FlirtCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener una frase coqueta. Intenta de nuevo.');
    }
  }
}
