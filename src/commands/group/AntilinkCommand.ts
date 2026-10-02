/**
 * AntilinkCommand.ts
 *
 * group command `antilink` — Protege grupos contra enlaces con whitelist y modos configurables
 * Usage: !antilink on|off|status|mode|tipo|allow|remove|list
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import { antilinkService } from '@/services/moderation/AntilinkService.js';
import type { MessageContext } from '@/types/index.js';

/** Command handler for `!antilink`: Protege grupos contra enlaces con whitelist y modos configurables. */
export class AntilinkCommand extends Command {
  name = 'antilink';
  description = 'Protege grupos contra enlaces con whitelist y modos configurables';
  category = CommandCategory.GROUP;
  usage = '!antilink on|off|status|mode|tipo|allow|remove|list';
  examples = [
    '!antilink on',
    '!antilink off',
    '!antilink mode kick',
    '!antilink tipo grupos on',
    '!antilink allow youtube.com',
    '!antilink remove youtube.com',
  ];
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
        antilinkService.enable(groupId);
        await ctx.reply('✅ AntiLink activado para este grupo.');
        break;
      }

      case 'off': {
        antilinkService.disable(groupId);
        await ctx.reply('✅ AntiLink desactivado para este grupo.');
        break;
      }

      case 'status':
      case 'estado': {
        const config = antilinkService.getConfig(groupId);
        const statusEmoji = config.enabled ? '🔴' : '⚪';
        const mode = config.mode.toUpperCase();

        const formatToggle = (value: boolean) => (value ? 'BLOQUEADO 🚫' : 'PERMITIDO ✅');

        await ctx.reply(
          `*ANTILINK*\n\n` +
            `Estado: ${statusEmoji} *${config.enabled ? 'ON' : 'OFF'}*\n` +
            `Modo: *${mode}*\n` +
            `Grupos WhatsApp: *${formatToggle(config.blockWhatsappGroups)}*\n` +
            `Canales WhatsApp: *${formatToggle(config.blockWhatsappChannels)}*\n` +
            `Otros enlaces: *${formatToggle(config.blockOtherLinks)}*\n` +
            `Whitelist: ${config.whitelist.length ? config.whitelist.join(', ') : 'vacía'}\n\n` +
            `Comandos:\n` +
            `• !antilink on - Activar\n` +
            `• !antilink off - Desactivar\n` +
            `• !antilink mode kick|delete - Modo sanción\n` +
            `• !antilink tipo grupos|canales|otros on|off - Filtrar tipos\n` +
            `• !antilink allow dominio.com - Permitir dominio\n` +
            `• !antilink remove dominio.com - Quitar dominio\n` +
            `• !antilink list - Ver whitelist`,
        );
        break;
      }

      case 'mode': {
        const mode = ctx.args[1]?.toLowerCase() as 'kick' | 'delete';
        if (!mode || !['kick', 'delete'].includes(mode)) {
          await ctx.reply(
            '*MODO ANTILINK*\n\n' +
              '• !antilink mode kick - Expulsar usuario\n' +
              '• !antilink mode delete - Borrar mensaje',
          );
          return;
        }
        antilinkService.setMode(groupId, mode);
        await ctx.reply(`✅ Modo actualizado a *${mode.toUpperCase()}*`);
        break;
      }

      case 'tipo':
      case 'filtro': {
        const target = ctx.args[1]?.toLowerCase();
        const toggle = ctx.args[2]?.toLowerCase();
        const typeMap: Record<string, 'groups' | 'channels' | 'others'> = {
          grupos: 'groups',
          grupo: 'groups',
          groups: 'groups',
          canales: 'channels',
          canal: 'channels',
          channels: 'channels',
          otros: 'others',
          otroslinks: 'others',
          other: 'others',
          others: 'others',
        };

        if (!target || !typeMap[target]) {
          await ctx.reply(
            '*TIPO DE ENLACE*\n\n' +
              '• !antilink tipo grupos on|off\n' +
              '• !antilink tipo canales on|off\n' +
              '• !antilink tipo otros on|off',
          );
          return;
        }

        if (!toggle || !['on', 'off'].includes(toggle)) {
          await ctx.reply('Usa: on o off');
          return;
        }

        const type = typeMap[target];
        const enabled = toggle === 'on';
        antilinkService.setBlockType(groupId, type, enabled);

        const typeLabels = { groups: 'Grupos WA', channels: 'Canales WA', others: 'Otros enlaces' };
        await ctx.reply(`${typeLabels[type]}: *${enabled ? 'BLOQUEADO' : 'PERMITIDO'}*`);
        break;
      }

      case 'allow':
      case 'permitir': {
        const domain = ctx.args.slice(1).join(' ').trim();
        if (!domain) {
          await ctx.reply('Usa: !antilink allow dominio.com');
          return;
        }
        const added = antilinkService.addToWhitelist(groupId, domain);
        if (added) {
          await ctx.reply(`✅ Dominio permitido: *${domain}*`);
        } else {
          await ctx.reply(`ℹ️ El dominio ya estaba en la whitelist.`);
        }
        break;
      }

      case 'remove':
      case 'del':
      case 'quitar': {
        const domain = ctx.args.slice(1).join(' ').trim();
        if (!domain) {
          await ctx.reply('Usa: !antilink remove dominio.com');
          return;
        }
        const removed = antilinkService.removeFromWhitelist(groupId, domain);
        if (removed) {
          await ctx.reply(`✅ Dominio removido de la whitelist: *${domain}*`);
        } else {
          await ctx.reply(`❌ El dominio no estaba en la whitelist.`);
        }
        break;
      }

      case 'list':
      case 'whitelist': {
        const whitelist = antilinkService.getWhitelist(groupId);
        if (whitelist.length === 0) {
          await ctx.reply('*WHITELIST*\n\nNo hay dominios permitidos.');
        } else {
          await ctx.reply(`*WHITELIST ANTILINK*\n\n` + whitelist.map(d => `• ${d}`).join('\n'));
        }
        break;
      }

      default:
        await ctx.reply(
          `*ANTILINK*\n\n` +
            `Protege grupos contra enlaces.\n\n` +
            `Comandos:\n` +
            `• !antilink on - Activar\n` +
            `• !antilink off - Desactivar\n` +
            `• !antilink status - Ver estado\n` +
            `• !antilink mode kick|delete - Modo\n` +
            `• !antilink tipo grupos|canales|otros on|off\n` +
            `• !antilink allow dominio - Permitir\n` +
            `• !antilink remove dominio - Quitar\n` +
            `• !antilink list - Ver whitelist`,
        );
    }
  }
}
