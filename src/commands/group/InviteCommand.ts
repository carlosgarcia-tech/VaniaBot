/**
 * InviteCommand.ts
 *
 * group command `invite` — Enviar enlace de invitación a un número
 * Usage: !invite <número>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!invite`: Enviar enlace de invitación a un número. */
export class InviteCommand extends Command {
  name = 'invite';
  description = 'Enviar enlace de invitación a un número';
  category = CommandCategory.GROUP;
  aliases = ['invitar'];
  usage = '!invite <número>';
  examples = ['!invite 5219514639799'];
  cooldown = 30_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const number = ctx.args[0];

    if (!number) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *necesito un número* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!invite* <número>\n` +
          `✩ ejemplo: *!invite 5219514639799* ✩`,
      );
      return;
    }

    const cleanNumber = number.replace(/[^0-9]/g, '');
    const targetJid = `${cleanNumber}@s.whatsapp.net`;

    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const botJid = ctx.sock.user?.id;
      const botIsAdmin = groupMeta.participants.find(p => p.id === botJid)?.admin;

      if (!botIsAdmin) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` + `❌ Necesito ser administrador para enviar invitaciones.`,
        );
        return;
      }

      const link = `https://chat.whatsapp.com/${await ctx.sock.groupInviteCode(ctx.chat.jid)}`;

      await ctx.sock.sendMessage(targetJid, {
        text:
          `˚₊· ͟͟͞͞➳ *invitación al grupo* ˚₊· ͟͟͞͞➳\n\n` +
          `Un usuario te invitó a unirte a este grupo 👇\n\n` +
          `${link}`,
        mentions: [ctx.sender.jid],
      });

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *enviado* ˚₊· ͟͟͞͞➳\n\n` + `✅ Se envió el enlace de invitación al número.`,
      );
    } catch (error: unknown) {
      logError('[InviteCommand] Error:', error);
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` +
          `❌ No pude enviar la invitación. Puede que el número no exista o no tenga WhatsApp.`,
      );
    }
  }
}
