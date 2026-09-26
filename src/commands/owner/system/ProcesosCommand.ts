/**
 * @fileoverview ProcesosCommand.ts - List active processes
 *
 * Shows a list of active processes similar to top.
 *
 * @module commands/owner/system/ProcesosCommand
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  PermissionLevel,
  CommandContext,
  type MessageContext,
} from '@/types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logError } from '@/utils/logger.js';

const execAsync = promisify(exec);

export class ProcesosCommand extends Command {
  name = 'procesos';
  description = 'Lista procesos activos';
  category = CommandCategory.OWNER;
  aliases = ['ps', 'tasks'];
  usage = '!procesos';
  examples = ['!procesos'];
  permissions = { user: [PermissionLevel.OWNER] };
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📋');
    await ctx.reply(`📋 Obteniendo procesos...`);

    try {
      const isLinux = process.platform !== 'win32';

      let command: string;
      if (isLinux) {
        command = 'ps aux --sort=-%mem | head -15';
      } else {
        command = 'tasklist /FO LIST /NH | findstr /i "node"';
      }

      const { stdout } = await execAsync(command, { timeout: 10000 });

      if (isLinux) {
        const lines = stdout.split('\n').filter(l => l.trim());
        let text = `╭─ ✦ *PROCESOS (Top 10 por memoria)*\n│\n`;

        lines.slice(0, 10).forEach(line => {
          const parts = line.split(/\s+/);
          if (parts.length >= 11) {
            const user = parts[0];
            const pid = parts[1];
            const cpu = parts[2];
            const mem = parts[3];
            const command = parts.slice(10).join(' ').slice(0, 40);

            text += `│ ${pid} │ ${cpu}%CPU │ ${mem}%MEM │ ${user.slice(0, 10)}\n`;
            text += `│ └─ ${command}\n`;
          }
        });

        text += `│\n╰───────────────`;
        await ctx.reply(text);
      } else {
        const lines = stdout
          .split('\n')
          .filter(l => l.trim())
          .slice(0, 10);
        let text = `╭─ ✦ *PROCESOS (Node)*\n│\n`;

        lines.forEach(line => {
          const match = line.match(/Image Name:\s*(.+)|PID:\s*(\d+)|Mem Usage:\s*(.+)/g);
          if (match) {
            const name = match[0]?.replace('Image Name:', '').trim() || '';
            const pid = match[1]?.replace('PID:', '').trim() || '';
            const mem = match[2]?.replace('Mem Usage:', '').trim() || '';
            if (name) text += `│ ${pid || '-'} │ ${mem || '-'} │ ${name}\n`;
          }
        });

        text += `│\n╰───────────────`;
        await ctx.reply(text || 'No se encontraron procesos');
      }
    } catch (error) {
      logError('ProcesosCommand error:', error);
      await ctx.reply('❌ Error al obtener procesos');
    }
  }
}
