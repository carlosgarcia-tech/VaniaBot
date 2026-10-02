/**
 * AntiCaidasCommand.ts
 *
 * owner command `anticaidas` — Pausa comandos con muchos errores repetidos
 * Usage: !anticaidas on|off|status|config|clear
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { resilienceService, formatDuration } from '@/services/system/ResilienceService.js';

/** Command handler for `!anticaidas`: Pausa comandos con muchos errores repetidos. */
export class AntiCaidasCommand extends Command {
  name = 'anticaidas';
  description = 'Pausa comandos con muchos errores repetidos';
  category = CommandCategory.OWNER;
  aliases = ['antifail', 'resilience', 'anticrash'];
  usage = '!anticaidas on|off|status|config|clear';
  examples = ['!anticaidas status', '!anticaidas config 4 15', '!anticaidas clear ytmp3'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase() || 'status';

    switch (action) {
      case 'on': {
        resilienceService.setConfig({ enabled: true });
        await ctx.reply('✅ Anti-caídas activado.');
        break;
      }

      case 'off': {
        resilienceService.setConfig({ enabled: false });
        await ctx.reply('✅ Anti-caídas desactivado.');
        break;
      }

      case 'config': {
        const threshold = parseInt(ctx.args[1], 10);
        const cooldownMinutes = parseInt(ctx.args[2], 10);

        if (!isNaN(threshold)) {
          resilienceService.setConfig({ threshold });
        }
        if (!isNaN(cooldownMinutes)) {
          resilienceService.setConfig({ cooldownMs: cooldownMinutes * 60 * 1000 });
        }

        const state = resilienceService.getSnapshot();
        await ctx.reply(
          `Anti-caídas actualizado.\n` +
            `Threshold: *${state.threshold} fallos*\n` +
            `Cooldown: *${formatDuration(state.cooldownMs)}*`,
        );
        break;
      }

      case 'clear': {
        const commandName = ctx.args[1]?.toLowerCase().trim();
        if (!commandName) {
          await ctx.reply('Uso: !anticaidas clear <comando>');
          return;
        }
        resilienceService.clearCommand(commandName);
        await ctx.reply(`✅ Estado limpiado para: *${commandName}*`);
        break;
      }

      case 'status':
      default: {
        const state = resilienceService.getSnapshot();
        const blocked = state.commands.filter(c => c.blocked).slice(0, 10);

        const blockedList = blocked.length
          ? blocked
              .map(c => {
                const remaining = Math.max(0, Math.ceil((c.disabledUntil - Date.now()) / 1000));
                return `• ${c.command}: ${remaining}s | ${c.lastError || 'sin error'}`;
              })
              .join('\n')
          : 'Ninguno';

        await ctx.reply(
          `*ANTI-CAÍDAS*\n\n` +
            `Estado: *${state.enabled ? 'ENCENDIDO' : 'APAGADO'}*\n` +
            `Threshold: *${state.threshold} fallos*\n` +
            `Cooldown: *${formatDuration(state.cooldownMs)}*\n\n` +
            `*COMANDOS BLOQUEADOS*\n` +
            blockedList +
            `\n\n` +
            `Comandos:\n` +
            `• !anticaidas on - Activar\n` +
            `• !anticaidas off - Desactivar\n` +
            `• !anticaidas config <fallos> <minutos> - Configurar\n` +
            `• !anticaidas clear <comando> - Limpiar estado`,
        );
        break;
      }
    }
  }
}
