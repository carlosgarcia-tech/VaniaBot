/**
 * DashboardCommand.ts
 *
 * owner command `dashboard` — Activa una mini API web con estado del bot
 * Usage: !dashboard on|off|status
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { dashboardService } from '@/services/system/DashboardService.js';

/** Command handler for `!dashboard`: Activa una mini API web con estado del bot. */
export class DashboardCommand extends Command {
  name = 'dashboard';
  description = 'Activa una mini API web con estado del bot';
  category = CommandCategory.OWNER;
  aliases = ['webpanel', 'panelweb', 'panel'];
  usage = '!dashboard on|off|status';
  examples = ['!dashboard status', '!dashboard on 3001', '!dashboard off'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase() || 'status';
    const port = parseInt(ctx.args[1], 10) || 3001;

    switch (action) {
      case 'on': {
        dashboardService.setConfig({ enabled: true, port });
        await dashboardService.start();
        await ctx.reply(`✅ Dashboard encendido en http://localhost:${port}`);
        break;
      }

      case 'off': {
        dashboardService.setConfig({ enabled: false });
        await dashboardService.stop();
        await ctx.reply('✅ Dashboard apagado.');
        break;
      }

      case 'status':
      default: {
        const config = dashboardService.getConfig();
        const snapshot = dashboardService.getSnapshot();
        const mainBot = snapshot.bots.find(b => b.id === 'main');

        await ctx.reply(
          `*DASHBOARD WEB*\n\n` +
            `Estado: *${config.enabled ? 'ENCENDIDO' : 'APAGADO'}*\n` +
            `Puerto: *${config.port}*\n` +
            `Bot principal: *${mainBot?.connected ? 'ONLINE' : 'OFFLINE'}*\n` +
            `Subbots visibles: *${snapshot.bots.length}*\n` +
            `RAM proceso: *${Math.round(snapshot.memory.rss / 1024 / 1024)} MB*\n\n` +
            `Comandos:\n` +
            `• !dashboard on - Activar\n` +
            `• !dashboard on 3001 - Activar en puerto\n` +
            `• !dashboard off - Desactivar`,
        );
        break;
      }
    }
  }
}
