import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { sessionBackupService } from '@/services/system/SessionBackupService.js';
import { healthCheckService } from '@/services/system/HealthCheckService.js';
import { queryOptimizer } from '@/services/database/DatabaseQueryOptimizer.js';
import { unifiedCache } from '@/services/system/UnifiedCacheService.js';
import { logger } from '@/utils/logger.js';

const MAX_BROADCAST_LENGTH = 4096;

function sanitizeBroadcastMessage(message: string): string {
  const sanitized = message
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\u2028|\u2029/g, ' ')
    .substring(0, MAX_BROADCAST_LENGTH)
    .trim();

  if (!sanitized || sanitized.length < 1) {
    throw new Error('Message is empty after sanitization');
  }

  return sanitized;
}

export class BroadcastCommand extends Command {
  name = 'broadcast';
  description = 'Enviar mensaje a todos los grupos';
  category = CommandCategory.OWNER;
  aliases = ['bc', 'anunciar'];
  usage = '.broadcast <mensaje>';
  examples = ['.broadcast Mensaje importante'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const rawMessage = ctx.args.join(' ');

    if (!rawMessage) {
      await ctx.reply('用法: .broadcast <mensaje>\nEjemplo: .broadcast Mensaje importante');
      return;
    }

    let sanitizedMessage: string;
    try {
      sanitizedMessage = sanitizeBroadcastMessage(rawMessage);
    } catch {
      await ctx.reply('❌ Mensaje inválido');
      return;
    }

    try {
      await ctx.react('⏳');
      logger.info(`[Broadcast] Starting broadcast by ${ctx.sender.jid}`);

      let sent = 0;
      let failed = 0;

      const groups = await ctx.sock.groupFetchAllParticipating();

      const results = await Promise.allSettled(
        Object.keys(groups).map(groupId =>
          ctx.sock.sendMessage(groupId, { text: sanitizedMessage }),
        ),
      );
      sent = results.filter(r => r.status === 'fulfilled').length;
      failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`[Broadcast] Completed: ${sent} sent, ${failed} failed`);
      await ctx.reply(`Broadcast completado\n\nEnviados: ${sent}\nFallidos: ${failed}`);
    } catch {
      await ctx.reply('❌ Error al enviar broadcast');
    }
  }
}

export class BackupCommand extends Command {
  name = 'backup';
  description = 'Crear respaldo de la sesión';
  category = CommandCategory.OWNER;
  aliases = ['respaldar'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.reply('Creando respaldo...');

      const backup = await sessionBackupService.performBackup();

      if (backup) {
        await ctx.reply(
          `✅ Respaldo creado\n\nArchivos: ${backup.files.length}\nTamaño: ${(backup.size / 1024).toFixed(2)} KB`,
        );
      } else {
        await ctx.reply('❌ Error al crear respaldo');
      }
    } catch {
      await ctx.reply('❌ Error al crear respaldo');
    }
  }
}

export class ListBackupsCommand extends Command {
  name = 'listbackups';
  description = 'Listar respaldos disponibles';
  category = CommandCategory.OWNER;
  aliases = ['backups', 'listabd'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const backups = sessionBackupService.listBackups();

      if (backups.length === 0) {
        await ctx.reply('No hay respaldos disponibles');
        return;
      }

      let message = `*📦 Respalos (${backups.length}):*\n\n`;

      for (const backup of backups.slice(0, 10)) {
        const date = new Date(backup.timestamp).toLocaleString();
        message += `• ${date}\n`;
        message += `  Archivos: ${backup.files.length}\n`;
        message += `  Tamaño: ${(backup.size / 1024).toFixed(2)} KB\n\n`;
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al listar respaldos');
    }
  }
}

export class SystemStatsCommand extends Command {
  name = 'sysstats';
  description = 'Ver estadísticas del sistema';
  category = CommandCategory.OWNER;
  aliases = ['systemstats', 'sysstatsinfo'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await healthCheckService.performHealthCheck();
      const metrics = healthCheckService.getSystemMetrics();
      const dbStats = queryOptimizer.getStats();
      const cacheStats = unifiedCache.getMemoryStats();

      let message = `*📊 Estadísticas del Sistema*\n\n`;

      message += `*🖥️ Proceso:*\n`;
      message += `  Uptime: ${Math.floor(metrics.process.uptime / 3600)}h\n`;
      message += `  PID: ${metrics.process.pid}\n`;
      message += `  Node: ${metrics.process.nodeVersion}\n\n`;

      message += `*💾 Memoria:*\n`;
      message += `  Usada: ${(metrics.memory.used / 1024 / 1024).toFixed(2)} MB\n`;
      message += `  Total: ${(metrics.memory.total / 1024 / 1024).toFixed(2)} MB\n`;
      message += `  Porcentaje: ${metrics.memory.percentage.toFixed(1)}%\n\n`;

      if (metrics.messageStats) {
        message += `*📨 Mensajes:*\n`;
        message += `  Recibidos: ${metrics.messageStats.received}\n`;
        message += `  Procesados: ${metrics.messageStats.processed}\n`;
        message += `  Comandos: ${metrics.messageStats.commands}\n\n`;
      }

      message += `*🗄️ Base de Datos:*\n`;
      message += `  Queries: ${dbStats.totalQueries}\n`;
      message += `  Cache hits: ${dbStats.cacheHits}\n`;
      message += `  Hit rate: ${dbStats.cacheStats.hitRate}\n\n`;

      message += `*⚡ Cache:*\n`;
      message += `  Entradas: ${cacheStats.size}\n`;
      message += `  Hit rate: ${cacheStats.hitRate}`;

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener estadísticas');
    }
  }
}

export class ClearCacheCommand extends Command {
  name = 'clearcache';
  description = 'Limpiar cache del sistema';
  category = CommandCategory.OWNER;
  aliases = ['cleancache'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.reply('🧹 Limpiando cache...');

      await unifiedCache.clear();
      queryOptimizer.clearCache();

      await ctx.reply('✅ Cache limpiado');
    } catch {
      await ctx.reply('❌ Error al limpiar cache');
    }
  }
}

export default [
  new BroadcastCommand(),
  new BackupCommand(),
  new ListBackupsCommand(),
  new SystemStatsCommand(),
  new ClearCacheCommand(),
];
