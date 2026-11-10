/**
 * PingCommand.ts
 *
 * utility command `ping` — Checks the bot's latency
 * Usage: !ping
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';

/** Command handler for `!ping`: Checks the bot's latency. */
export class PingCommand extends Command {
  name = 'ping';
  description = 'Verifica la latencia del bot';
  category = CommandCategory.UTILITY;

  aliases = ['p', 'latency'];
  usage = '!ping';
  examples = ['!ping', '!p'];

  async execute(ctx: MessageContext): Promise<void> {
    const start = Date.now();

    await ctx.reply('🏓 Calculando...');

    const latency = Date.now() - start;

    await ctx.sock.sendMessage(ctx.chat.jid, {
      text: `🏓 Pong!\n⏱️ Latencia: ${latency}ms`,
    });
  }
}
