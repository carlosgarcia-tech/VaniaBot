/**
 * FantasmasCommand.ts
 *
 * group command `fantasmas` — Ver usuarios inactivos en el grupo
 * Usage: !fantasmas [kick]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError } from '@/utils/logger.js';

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Command handler for `!fantasmas`: Ver usuarios inactivos en el grupo. */
export class FantasmasCommand extends Command {
  name = 'fantasmas';
  description = 'Ver usuarios inactivos en el grupo';
  category = CommandCategory.GROUP;
  aliases = ['fantasma', 'kickfantasmas'];
  usage = '!fantasmas [kick]';
  examples = ['!fantasmas', '!fantasmas kick'];
  cooldown = 30_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const shouldKick = ctx.args[0]?.toLowerCase() === 'kick';

    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const participants = groupMeta.participants;
      const ghosts: string[] = [];

      for (const participant of participants) {
        const userId = participant.id;
        if (participant.admin || userId === ctx.sock.user?.id) continue;

        const userData = await serviceManager.userService.getUser(userId);
        if (!userData || userData.totalCommands === 0) {
          ghosts.push(userId);
        }
      }

      if (ghosts.length === 0) {
        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *sin fantasmas* ˚₊· ͟͟͞͞➳\n\n` + `🎌 Este grupo es activo, no tiene fantasmas.`,
        );
        return;
      }

      const ghostMentions = ghosts.map(g => `@${g.split('@')[0]}`).join('\n');

      await ctx.sock.sendMessage(ctx.chat.jid, {
        text:
          `˚₊· ͟͟͞͞➳ *revisión de fantasmas* ˚₊· ͟͟͞͞➳\n\n` +
          `⚠️ *Lista de fantasmas* (${ghosts.length}):\n\n` +
          `${ghostMentions}\n\n` +
          `📝 *Nota:* Esto no es 100% exacto; el bot cuenta desde que se activa en este número.`,
        mentions: ghosts,
      });

      if (shouldKick) {
        const botJid = ctx.sock.user?.id;
        const botIsAdmin = groupMeta.participants.find(p => p.id === botJid)?.admin;

        if (!botIsAdmin) {
          await ctx.reply(
            `˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` + `❌ Necesito ser administrador para eliminar fantasmas.`,
          );
          return;
        }

        await ctx.reply(
          `˚₊· ͟͟͞͞➳ *eliminando fantasmas* ˚₊· ͟͟͞͞➳\n\n` + `🚨 Eliminando fantasmas... cada 10 segundos.`,
        );

        for (const ghost of ghosts) {
          try {
            await ctx.sock.groupParticipantsUpdate(ctx.chat.jid, [ghost], 'remove');
            await delay(10_000);
          } catch {
            continue;
          }
        }

        await ctx.reply(`˚₊· ͟͟͞͞➳ *listo* ˚₊· ͟͟͞͞➳\n\n` + `✅ Proceso de eliminación completado.`);
      }
    } catch (error) {
      logError('[FantasmasCommand] Error:', error);
      await ctx.reply(`˚₊· ͟͟͞͞➳ *ups* ˚₊· ͟͟͞͞➳\n\n` + `❌ Ocurrió un error al buscar fantasmas.`);
    }
  }
}
