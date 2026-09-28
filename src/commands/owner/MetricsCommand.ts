import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { commandRegistry } from '@/core/CommandRegistry.js';
import { primeService } from '@/services/system/PrimeService.js';
import { cacheManager } from '@/core/CacheManager.js';

export class MetricsCommand extends Command {
  name = 'metrics';
  description = 'Muestra métricas y estadísticas del bot';
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER] };
  aliases = ['metricas', 'botstats'];
  usage = '!metrics';
  examples = ['!metrics'];
  cooldown = 15000;
  contexts = [CommandContext.PRIVATE];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📊');

    const cacheStats = cacheManager.getStats();

    let message = `📊 *Métricas de VaniaBot*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;

    message += `*Cache:*\n`;
    message += `  💾 Hit rate: ${cacheStats.hitRate}\n`;
    message += `  📦 Users: ${cacheStats.sizes?.users ?? 0}\n`;
    message += `  📦 Metadata: ${cacheStats.sizes?.metadata ?? 0}\n`;
    message += `  ✅ Hits: ${cacheStats.hits.toLocaleString()}\n`;
    message += `  ❌ Misses: ${cacheStats.misses.toLocaleString()}\n`;

    message += `\n*Sistema:*\n`;
    message += `  🧠 Memoria: ${this.formatBytes(process.memoryUsage().heapUsed)}\n`;
    message += `  ⏰ Uptime: ${this.formatUptime(process.uptime())}\n`;
    message += `  📝 Comandos registrados: ${commandRegistry.size}\n`;

    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    message += `\n${footer}`;

    await ctx.reply(message);
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }
}
