/**
 * AntiArabCommand.ts
 *
 * group command `antiarab` — Bloquea usuarios con números de países árabes
 * Usage: !antiarab on|off|status|prefix
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import { antiArabService } from '@/services/moderation/AntiArabService.js';
import type { MessageContext } from '@/types/index.js';

/** Command handler for `!antiarab`: Bloquea usuarios con números de países árabes. */
export class AntiArabCommand extends Command {
  name = 'antiarab';
  description = 'Bloquea usuarios con números de países árabes';
  category = CommandCategory.GROUP;
  usage = '!antiarab on|off|status|prefix';
  examples = ['!antiarab on', '!antiarab off', '!antiarab status', '!antiarab prefix'];
  cooldown = 5000;
  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase() || 'status';
    const groupId = ctx.chat.jid;

    switch (action) {
      case 'on': {
        antiArabService.enableGroup(groupId);
        await ctx.reply('✅ AntiArab activado para este grupo.');
        break;
      }

      case 'off': {
        antiArabService.disableGroup(groupId);
        await ctx.reply('✅ AntiArab desactivado para este grupo.');
        break;
      }

      case 'status': {
        const config = antiArabService.getGroupConfig(groupId);
        const status = config.enabled ? '🔴 ACTIVADO' : '⚪ DESACTIVADO';
        const prefixes = config.prefixes.join(', ') || 'ninguno';

        await ctx.reply(
          `*ANTIARAB*\n\n` +
            `Estado: ${status}\n\n` +
            `Prefijos bloqueados:\n${prefixes}\n\n` +
            `Comandos:\n` +
            `• !antiarab on - Activar\n` +
            `• !antiarab off - Desactivar\n` +
            `• !antiarab prefix add +966 - Agregar prefijo\n` +
            `• !antiarab prefix remove +966 - Quitar prefijo`,
        );
        break;
      }

      case 'prefix': {
        const subAction = ctx.args[1]?.toLowerCase();
        const prefix = ctx.args[2]?.trim();

        if (subAction === 'add' && prefix) {
          const cleanPrefix = prefix.replace(/[^\d+]/g, '');
          if (!cleanPrefix) {
            await ctx.reply('❌ Prefijo inválido. Ejemplo: +966, +212');
            return;
          }
          antiArabService.addPrefix(groupId, cleanPrefix);
          await ctx.reply(`✅ Prefijo *${cleanPrefix}* agregado a la lista de bloqueo.`);
          break;
        }

        if (subAction === 'remove' && prefix) {
          const cleanPrefix = prefix.replace(/[^\d+]/g, '');
          if (!cleanPrefix) {
            await ctx.reply('❌ Prefijo inválido. Ejemplo: +966, +212');
            return;
          }
          const removed = antiArabService.removePrefix(groupId, cleanPrefix);
          if (removed) {
            await ctx.reply(`✅ Prefijo *${cleanPrefix}* removido de la lista.`);
          } else {
            await ctx.reply(`❌ El prefijo *${cleanPrefix}* no estaba en la lista.`);
          }
          break;
        }

        const config = antiArabService.getGroupConfig(groupId);
        const prefixes = config.prefixes.join(', ') || 'ninguno';
        await ctx.reply(
          `*PREFIJOS ANTIARAB*\n\n` +
            `Actuales: ${prefixes}\n\n` +
            `Comandos:\n` +
            `• !antiarab prefix add +966 - Agregar\n` +
            `• !antiarab prefix remove +966 - Quitar`,
        );
        break;
      }

      default:
        await ctx.reply(
          `*ANTIARAB*\n\n` +
            `Filtra números de ciertos países.\n\n` +
            `Comandos:\n` +
            `• !antiarab on - Activar\n` +
            `• !antiarab off - Desactivar\n` +
            `• !antiarab status - Ver estado\n` +
            `• !antiarab prefix add +966 - Agregar prefijo\n` +
            `• !antiarab prefix remove +966 - Quitar prefijo`,
        );
    }
  }
}
