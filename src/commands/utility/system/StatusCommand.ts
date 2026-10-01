import { Command } from '@/commands/Command.js';
import { type MessageContext, PermissionLevel, CommandCategory } from '@/types/index.js';
import { healthCheckService } from '@/services/system/HealthCheckService.js';

export class StatusCommand extends Command {
  name = 'status';
  description = 'Ver estado y salud del sistema';
  // Sin alias 'health': es el name de HealthCommand.
  aliases = ['sysinfo'];
  category = CommandCategory.UTILITY;
  cooldown = 5000;
  permissions = {
    user: [PermissionLevel.USER],
    bot: [],
  };

  async execute(ctx: MessageContext): Promise<void> {
    try {
      await ctx.reply('🔄 Obteniendo estado del sistema...');

      const health = await healthCheckService.performHealthCheck();
      const metrics = healthCheckService.getSystemMetrics();

      const statusEmoji =
        health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
      const uptime = this.formatUptime(health.uptime);

      let message = `${statusEmoji} *Estado del Sistema*\n\n`;
      message += `📊 *Estado:* ${health.status.toUpperCase()}\n`;
      message += `⏱️ *Uptime:* ${uptime}\n`;
      message += `🖥️ *Plataforma:* ${metrics.process.platform}\n`;
      message += `🧬 *Node:* ${metrics.process.nodeVersion}\n\n`;

      message += `📈 *Checks (${health.summary.passed}/${health.summary.total}):*\n`;
      for (const check of health.checks) {
        const emoji = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
        message += `${emoji} ${check.name}: ${check.message}\n`;
      }

      message += `\n💾 *Memoria:*\n`;
      message += `   Usada: ${(metrics.memory.used / 1024 / 1024).toFixed(2)} MB\n`;
      message += `   Total: ${(metrics.memory.total / 1024 / 1024).toFixed(2)} MB\n`;
      message += `   Porcentaje: ${metrics.memory.percentage.toFixed(1)}%\n`;

      if (metrics.messageStats) {
        message += `\n📨 *Mensajes:*\n`;
        message += `   Recibidos: ${metrics.messageStats.received}\n`;
        message += `   Procesados: ${metrics.messageStats.processed}\n`;
        message += `   Comandos: ${metrics.messageStats.commands}\n`;
        message += `   Errores: ${metrics.messageStats.errors}\n`;
        message += `   Spam bloqueado: ${metrics.messageStats.spamBlocked}\n`;
        if (metrics.messageStats.avgProcessingTime > 0) {
          message += `   Tiempo promedio: ${metrics.messageStats.avgProcessingTime.toFixed(0)}ms\n`;
        }
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al obtener estado del sistema');
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

export class HealthCommand extends Command {
  name = 'health';
  description = 'Verificar salud del bot';
  // Sin alias 'ping': es el name de PingCommand y el registro remapeaba
  // !ping hacia este comando, sabotenado el ping de latencia real.
  aliases = ['pong'];
  category = CommandCategory.UTILITY;
  cooldown = 3000;

  async execute(ctx: MessageContext): Promise<void> {
    const start = Date.now();

    try {
      const health = await healthCheckService.performHealthCheck();
      const latency = Date.now() - start;

      const statusEmoji =
        health.status === 'healthy' ? '🟢' : health.status === 'degraded' ? '🟡' : '🔴';

      let message = `${statusEmoji} *Health Check*\n\n`;
      message += `⏱️ *Latencia:* ${latency}ms\n`;
      message += `📊 *Estado:* ${health.status}\n`;
      message += `✅ *Passed:* ${health.summary.passed}/${health.summary.total}\n`;

      if (health.summary.failed > 0) {
        message += `\n❌ *Failed checks:*\n`;
        for (const check of health.checks.filter(c => c.status === 'fail')) {
          message += `   - ${check.name}: ${check.message}\n`;
        }
      }

      if (health.summary.warnings > 0) {
        message += `\n⚠️ *Warnings:*\n`;
        for (const check of health.checks.filter(c => c.status === 'warn')) {
          message += `   - ${check.name}: ${check.message}\n`;
        }
      }

      await ctx.reply(message);
    } catch {
      await ctx.reply('❌ Error al verificar salud');
    }
  }
}
