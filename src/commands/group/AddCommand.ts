/**
 * AddCommand.ts
 *
 * group command `add` — Agregar usuario directamente al grupo
 * Usage: !add <numero>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!add`: Agregar usuario directamente al grupo. */
export class AddCommand extends Command {
  name = 'add';
  description = 'Agregar usuario directamente al grupo';
  category = CommandCategory.GROUP;
  aliases = ['agregar', 'añadir'];
  usage = '!add <numero>';
  examples = ['!add 5219514639799'];
  cooldown = 30_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const number = ctx.args[0]?.replace(/[^0-9]/g, '');

    if (!number) {
      await ctx.reply('* Usage:\n!add <numero>\nEjemplo: !add 5219514639799*');
      return;
    }

    try {
      await ctx.loadBotPermissions();

      if (!ctx.chat.isBotAdmin) {
        await ctx.reply('*Error*\nNecesito ser admin para agregar usuarios.');
        return;
      }

      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);

      const existsResult = await ctx.sock.onWhatsApp(number + '@s.whatsapp.net');
      const exists = existsResult?.[0];
      if (!exists || !exists.exists) {
        await ctx.reply(`*Error*\nEl numero ${number} no existe en WhatsApp.`);
        return;
      }

      const participants = groupMeta.participants.map(p => p.id);
      const isAlreadyInGroup = participants.some(p => {
        const pPhone = p.replace(/[^0-9]/g, '');
        return pPhone === number || p.includes(number);
      });
      if (isAlreadyInGroup) {
        await ctx.reply(`*Error*\nEl usuario ${number} ya esta en el grupo.`);
        return;
      }

      await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [exists.jid], 'add');

      await ctx.reply(`*Listo*\n${number} agregado exitosamente.`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('[AddCommand] Error:', error);

      if (errorMessage.includes('403')) {
        await ctx.reply('*Error*\nEl usuario tiene privacidad configurada para no ser agregado.');
        return;
      }

      if (errorMessage.includes('408')) {
        await ctx.reply('*Error*\nTimeout. El usuario no respondio a tiempo.');
        return;
      }

      if (errorMessage.includes('409') || errorMessage.includes('bad-request')) {
        await ctx.reply(
          '*Error*\nNo pude agregar al usuario. Puede que haya sido eliminado recientemente.',
        );
        return;
      }

      await ctx.reply('*Error*\nNo pude agregar al usuario.');
    }
  }
}
