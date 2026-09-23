import { Router } from 'express';
import type { Request, Response } from 'express';
import os from 'os';
import { webhookService } from '../WebhookService.js';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { healthCheckService } from '@/services/system/HealthCheckService.js';
import { cacheManager } from '@/core/CacheManager.js';
import type { WhatsAppClient } from '@/core/Client.js';
import { requireApiToken } from './auth.js';

function getClient() {
  return (global as { client?: WhatsAppClient }).client;
}

export function createSystemRouter(webhookToken: string): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() });
  });

  router.get('/health/detailed', async (_req: Request, res: Response) => {
    try {
      const memory = process.memoryUsage();
      const health = await healthCheckService.performHealthCheck();
      const totalMem = os.totalmem();
      res.json({
        ...health,
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpuCount: os.cpus().length,
          cpuModel: os.cpus()[0]?.model || 'Unknown',
          totalMemory: totalMem,
          freeMemory: os.freemem(),
          uptime: os.uptime(),
        },
        process: {
          pid: process.pid,
          nodeVersion: process.version,
          memory: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
            external: memory.external,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/bots', (_req: Request, res: Response) => {
    const bots: Array<{ id: string; name: string; connected: boolean; uptime?: number }> = [];
    const mainBotConnected = getClient()?.isClientReady() ?? false;
    bots.push({
      id: 'main',
      name: 'VaniaBot',
      connected: mainBotConnected,
      uptime: process.uptime(),
    });
    res.json(bots);
  });

  router.get('/stats', (_req: Request, res: Response) => {
    const slots = subBotDatabase.getAllSlots();
    const webhookStats = webhookService.getStats();
    const mainBotConnected = getClient()?.isClientReady() ?? false;
    const memory = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const clientStats = getClient()?.getStats();

    res.json({
      bots: [
        { id: 'main', name: 'VaniaBot', connected: mainBotConnected, uptime: process.uptime() },
      ],
      memory: { rss: memory.rss, heapTotal: memory.heapTotal, heapUsed: memory.heapUsed },
      memorySystem: {
        total: totalMem,
        used: totalMem - freeMem,
        free: freeMem,
        percentage: totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0,
      },
      uptime: process.uptime(),
      slots: {
        total: subBotDatabase.getMaxSlots(),
        used: subBotDatabase.getUsedSlotCount(),
        available: subBotDatabase.getMaxSlots() - subBotDatabase.getUsedSlotCount(),
        details: slots.map(s => ({
          slot: s.slot,
          status: s.status,
          owner: s.ownerName || null,
          phone: s.phoneNumber
            ? `+${s.phoneNumber.slice(0, 6)}****${s.phoneNumber.slice(-4)}`
            : null,
          connectedAt: s.connectedAt,
        })),
      },
      webhook: webhookStats,
      publicRequests: subBotDatabase.isPublicRequestsEnabled(),
      stats: clientStats
        ? {
            messagesReceived: clientStats.messagesReceived,
            messagesProcessed: clientStats.messagesProcessed,
            commandsExecuted: clientStats.commandsExecuted,
            errorsCount: clientStats.errorsCount,
            spamBlocked: clientStats.spamBlocked,
            avgProcessingTime: clientStats.avgProcessingTime,
          }
        : null,
      averages: { messages: 0, commands: 0, errors: 0 },
    });
  });

  router.get('/commands/metrics', (_req: Request, res: Response) => {
    const client = getClient();
    const metrics = client?.getStats()?.commandMetrics || new Map();
    const commands: Array<{
      name: string;
      count: number;
      totalTime: number;
      errors: number;
      avgTime: number;
    }> = [];
    (metrics as Map<string, { count: number; totalTime: number; errors: number }>).forEach(
      (data, name) => {
        commands.push({
          name,
          count: data.count,
          totalTime: data.totalTime,
          errors: data.errors,
          avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
        });
      },
    );
    commands.sort((a, b) => b.count - a.count);
    const clientStats = client?.getStats();
    res.json({
      commands: commands.slice(0, 50),
      topCommands: commands.slice(0, 10),
      totalCommands: commands.reduce((sum, c) => sum + c.count, 0),
      totalErrors: commands.reduce((sum, c) => sum + c.errors, 0),
      stats: clientStats
        ? {
            messagesReceived: clientStats.messagesReceived,
            messagesProcessed: clientStats.messagesProcessed,
            commandsExecuted: clientStats.commandsExecuted,
            errorsCount: clientStats.errorsCount,
            spamBlocked: clientStats.spamBlocked,
            avgProcessingTime: clientStats.avgProcessingTime,
          }
        : null,
    });
  });

  router.get('/metrics/realtime', (_req: Request, res: Response) => {
    const stats = getClient()?.getStats();
    const now = Date.now() / 1000;
    const history = stats
      ? [
          {
            timestamp: now,
            messagesPerMinute: stats.messagesReceived || 0,
            commandsPerMinute: stats.commandsExecuted || 0,
          },
        ]
      : [];
    res.json({ history });
  });

  router.get('/logs', (req: Request, res: Response) => {
    const _limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    res.json({ logs: [] });
  });

  router.get('/cache/stats', (_req: Request, res: Response) => {
    const stats = cacheManager.getStats?.() || { hits: 0, misses: 0 };
    res.json(stats);
  });

  router.get('/settings', (_req: Request, res: Response) => {
    res.json({
      publicRequests: subBotDatabase.isPublicRequestsEnabled(),
      maxSlots: subBotDatabase.getMaxSlots(),
    });
  });

  // Mutating endpoint: requires the API token (header or ?token= query).
  router.post('/settings', requireApiToken(webhookToken), (req: Request, res: Response) => {
    const { publicRequests, maxSlots } = req.body;
    if (typeof publicRequests === 'boolean') subBotDatabase.setPublicRequests(publicRequests);
    if (typeof maxSlots === 'number' && maxSlots > 0 && maxSlots <= 50)
      subBotDatabase.setMaxSlots(maxSlots);
    res.json({
      success: true,
      publicRequests: subBotDatabase.isPublicRequestsEnabled(),
      maxSlots: subBotDatabase.getMaxSlots(),
    });
  });

  return router;
}
