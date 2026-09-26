/**
 * @fileoverview ProcinfoCommand.ts - Process information
 *
 * Shows detailed information about the current process.
 *
 * @module commands/owner/system/ProcinfoCommand
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  PermissionLevel,
  CommandContext,
  type MessageContext,
} from '@/types/index.js';
import os from 'os';

export class ProcinfoCommand extends Command {
  name = 'procinfo';
  description = 'Información del proceso';
  category = CommandCategory.OWNER;
  aliases = ['procinfo', 'processinfo'];
  usage = '!procinfo';
  examples = ['!procinfo'];
  permissions = { user: [PermissionLevel.OWNER] };
  contexts = [CommandContext.BOTH];

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  getCpuUsage(): string {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const usage = ((1 - totalIdle / totalTick) * 100).toFixed(1);
    return `${usage}%`;
  }

  async execute(ctx: MessageContext): Promise<void> {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = process.uptime();
    const systemUptime = os.uptime();

    const text =
      `╭─ ✦ *INFO DEL PROCESO*\n` +
      `│\n` +
      `│ ⚡ *PID:* ${process.pid}\n` +
      `│ 📂 *Node:* ${process.version}\n` +
      `│ 🕐 *Uptime:* ${this.formatUptime(uptime)}\n` +
      `│ 🖥️ *Sistema uptime:* ${this.formatUptime(systemUptime)}\n` +
      `│\n` +
      `│ 📊 *MEMORIA*\n` +
      `│ ├─ RSS: ${this.formatBytes(mem.rss)}\n` +
      `│ ├─ Heap: ${this.formatBytes(mem.heapUsed)} / ${this.formatBytes(mem.heapTotal)}\n` +
      `│ ├─ Externo: ${this.formatBytes(mem.external)}\n` +
      `│ └─ Sistema: ${this.formatBytes(totalMem - freeMem)} / ${this.formatBytes(totalMem)}\n` +
      `│\n` +
      `│ 💻 *CPU*\n` +
      `│ ├─ Modelo: ${os.cpus()[0]?.model || 'Unknown'}\n` +
      `│ ├─ Núcleos: ${os.cpus().length}\n` +
      `│ └─ Uso: ${this.getCpuUsage()}\n` +
      `│\n` +
      `╰───────────────`;

    await ctx.reply(text);
  }
}
