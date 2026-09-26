import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError } from '@/utils/logger.js';

export class NsfwToggleCommand extends Command {
  name = 'nsfw';
  description = 'Habilitar/deshabilitar comandos NSFW';
  category = CommandCategory.OWNER;
  aliases = ['nsfwmode'];
  usage = '!nsfw <on/off/status>';
  examples = ['!nsfw on', '!nsfw off', '!nsfw status'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  /**
   * @deprecated Legacy in-memory flag kept for backwards compatibility with
   * code that reads NsfwToggleCommand.isEnabled(). The source of truth is
   * now serviceManager.nsfwToggleService (persisted across restarts).
   */
  private static legacyEnabled = false;

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args?.[0]?.toLowerCase();
    const groupJid = ctx.chat.isGroup ? ctx.chat.jid : null;

    try {
      if (!action || action === 'status') {
        const enabled = await serviceManager.nsfwToggleService.isEnabled(groupJid);
        const status = enabled ? '✅ *HABILITADOS*' : '❌ *DESHABILITADOS*';
        const scope = groupJid ? '📌 *Este grupo:*' : '🌐 *Global:*';
        await ctx.reply(`🔞 NSFW ${scope} ${status}\n\nUsa: !nsfw on/off`);
        return;
      }

      if (action === 'on') {
        await serviceManager.nsfwToggleService.setEnabled(true, ctx.sender.jid, groupJid);
        NsfwToggleCommand.legacyEnabled = true;
        await ctx.reply('✅ *Comandos NSFW habilitados*');
      } else if (action === 'off') {
        await serviceManager.nsfwToggleService.setEnabled(false, ctx.sender.jid, groupJid);
        NsfwToggleCommand.legacyEnabled = false;
        await ctx.reply('❌ *Comandos NSFW deshabilitados*');
      } else {
        await ctx.reply('✍️ *Uso:* !nsfw <on/off/status>');
      }
    } catch (error) {
      logError('[NsfwToggleCommand] Error', error);
      await ctx.reply('❌ No pude cambiar el estado NSFW. Intenta de nuevo.');
    }
  }

  static isEnabled(): boolean {
    return NsfwToggleCommand.legacyEnabled;
  }
}
