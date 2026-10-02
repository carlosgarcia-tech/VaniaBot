/**
 * StatsCommand.ts
 *
 * utility command `botinfo` — Displays real-time bot statistics
 * Usage: !botinfo
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { cacheManager } from '@/core/CacheManager.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { SQLiteAdapter } from '@/services/database/SQLiteAdapter.js';

interface ClientStats {
  messagesReceived: number;
  messagesProcessed: number;
  commandsExecuted: number;
  spamBlocked: number;
  avgProcessingTime: number;
  queue: {
    queued: number;
    processing: number;
  };
  errorsCount: number;
}

interface CacheStats {
  hitRate: string;
  sizes: {
    users: number;
    permissions: number;
    metadata: number;
    messages: number;
  };
}

/** Command handler for `!botinfo`: Displays real-time bot statistics. */
export class StatsCommand extends Command {
  name = 'botinfo';
  description = 'Displays real-time bot statistics';
  category = CommandCategory.UTILITY;
  requiresRegistration = true;
  aliases = ['infobot'];
  usage = '!botinfo';
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const client = (global as { client?: { getStats: () => ClientStats } }).client;
    const clientStats = client?.getStats() || {
      messagesReceived: 0,
      messagesProcessed: 0,
      commandsExecuted: 0,
      spamBlocked: 0,
      avgProcessingTime: 0,
      queue: { queued: 0, processing: 0 },
      errorsCount: 0,
    };

    const cacheStats = cacheManager.getStats() as CacheStats;

    let dbStats: { hitRate: string; size: number | string } = {
      hitRate: 'N/A',
      size: 'N/A',
    };

    if (serviceManager.db instanceof SQLiteAdapter) {
      dbStats = {
        hitRate: 'SQLite (N/A)',
        size: 'Persistent',
      };
    }

    const uptime = this.formatUptime(process.uptime() * 1000);
    const memUsage = process.memoryUsage();
    const memUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const memTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

    const message = `
*BOT STATISTICS*

**Uptime**
${uptime}

**Memory Usage**
${memUsed} MB used / ${memTotal} MB total

**Messages**
• Received: ${clientStats.messagesReceived}
• Processed: ${clientStats.messagesProcessed}
• Commands executed: ${clientStats.commandsExecuted}
• Spam blocked: ${clientStats.spamBlocked}

**Performance**
• Average processing time: ${clientStats.avgProcessingTime.toFixed(0)} ms
• Queue: ${clientStats.queue.queued} queued, ${clientStats.queue.processing} processing

**Cache**
• Hit rate: ${cacheStats.hitRate}
• Users: ${cacheStats.sizes.users}
• Permissions: ${cacheStats.sizes.permissions}
• Metadata: ${cacheStats.sizes.metadata}
• Messages: ${cacheStats.sizes.messages}

**Database**
• Hit rate: ${dbStats.hitRate}
• Cache size: ${dbStats.size}

**Errors**
${clientStats.errorsCount}
    `.trim();

    await ctx.reply(message);
  }

  private formatUptime(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
