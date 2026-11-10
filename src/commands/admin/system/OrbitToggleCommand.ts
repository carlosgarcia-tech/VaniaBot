/**
 * OrbitToggleCommand.ts
 *
 * admin command `orbitoff` — Disables Orbit in this group
 * Usage: !orbitoff [slot]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!orbitoff`: Disables Orbit in this group. */
export class OrbitOffCommand extends Command {
  name = 'orbitoff';
  description = 'Desactiva a Orbit en este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['orbitoff', 'botoff', 'apagar'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!orbitoff [slot]';
  examples = ['!orbitoff', '!orbitoff 1', '!orbitoff 2'];
  permissions = { user: [PermissionLevel.OWNER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      let targetBotId = ctx.botId;
      let targetSlot: number | undefined;

      if (ctx.args[0]) {
        const slotNum = parseInt(ctx.args[0]);
        if (!isNaN(slotNum) && slotNum > 0 && slotNum <= 50) {
          targetSlot = slotNum;
          targetBotId = `subbot${slotNum}`;
        }
      }

      const isEnabled = await serviceManager.orbitToggleService.isEnabled(
        ctx.chat.jid,
        targetBotId,
      );

      if (!isEnabled) {
        const botName = targetSlot ? `SubBot ${targetSlot}` : 'Orbit';
        await ctx.reply(`🔴 *${botName} ya está desactivada* en este grupo.`);
        return;
      }

      await serviceManager.orbitToggleService.disable(ctx.chat.jid, ctx.sender.jid, targetBotId);

      const botName = targetSlot ? `SubBot ${targetSlot}` : 'Orbit';
      await ctx.react('🔴');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *${botName} está descansando* ˚₊· ͟͟͞͞➳\n\n` +
          `No voy a responder hasta que me activen con *!orbiton${targetSlot ? ' ' + targetSlot : ''}*.\n\n` +
          `_Me apagó @${ctx.sender.pushName || 'admin'}_ ✿`,
      );
    } catch (error) {
      logError('[OrbitOff] Error', error);
      await ctx.reply('❌ Ocurrió un error. Intenta de nuevo.');
    }
  }
}

export class OrbitOnCommand extends Command {
  name = 'orbiton';
  description = 'Activa a Orbit en este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['orbiton', 'boton', 'encender'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!orbiton [slot]';
  examples = ['!orbiton', '!orbiton 1', '!orbiton 2'];
  permissions = { user: [PermissionLevel.OWNER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      let targetBotId = ctx.botId;
      let targetSlot: number | undefined;

      if (ctx.args[0]) {
        const slotNum = parseInt(ctx.args[0]);
        if (!isNaN(slotNum) && slotNum > 0 && slotNum <= 50) {
          targetSlot = slotNum;
          targetBotId = `subbot${slotNum}`;
        }
      }

      const isEnabled = await serviceManager.orbitToggleService.isEnabled(
        ctx.chat.jid,
        targetBotId,
      );

      if (isEnabled) {
        const botName = targetSlot ? `SubBot ${targetSlot}` : 'Orbit';
        await ctx.reply(`🟢 *${botName} ya está activada* en este grupo.`);
        return;
      }

      await serviceManager.orbitToggleService.enable(ctx.chat.jid, ctx.sender.jid, targetBotId);

      const botName = targetSlot ? `SubBot ${targetSlot}` : 'Orbit';
      await ctx.react('🟢');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *${botName} ya está aquí* ˚₊· ͟͟͞͞➳\n\n` +
          `¡Listo, ya puedo funcionar! ✿\n\n` +
          `_Me encendió @${ctx.sender.pushName || 'admin'}_ ✩`,
      );
    } catch (error) {
      logError('[OrbitOn] Error', error);
      await ctx.reply('❌ Ocurrió un error. Intenta de nuevo.');
    }
  }
}

export class OrbitStatusCommand extends Command {
  name = 'orbitstatus';
  description = 'Muestra el estado de Orbit en este grupo';
  category = CommandCategory.ADMIN;
  aliases = ['orbitstatus', 'botstatus'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!orbitstatus';
  examples = ['!orbitstatus'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const { enabled, record } = await serviceManager.orbitToggleService.getStatus(
        ctx.chat.jid,
        ctx.botId,
      );

      const botName = ctx.botId === 'main' ? 'Orbit' : ctx.botId;
      const status = enabled ? '🟢 *Activada*' : '🔴 *Desactivada*';

      let info = `📊 *Estado de ${botName}*\n\n${status}`;

      if (record) {
        if (!enabled && record.disabledBy) {
          info += `\n\n🔴 Desactivada por: @${record.disabledBy.split('@')[0]}`;
          info += `\n⏰ Hora: ${new Date(record.disabledAt).toLocaleString()}`;
        } else if (enabled && record.enabledBy) {
          info += `\n\n🟢 Activada por: @${record.enabledBy.split('@')[0]}`;
          info += `\n⏰ Hora: ${new Date(record.enabledAt).toLocaleString()}`;
        }
      }

      await ctx.reply(info);
    } catch (error) {
      logError('[OrbitStatus] Error', error);
      await ctx.reply('❌ Ocurrió un error. Intenta de nuevo.');
    }
  }
}
