/**
 * DashboardService.ts
 *
 * Read-mostly Express server backing the web panel: system stats, per-command
 * metrics, slot management, moderation lists and a small in-memory log tail.
 *
 * Distinct from the webhook panel (services/webhook): this one serves static UI
 * plus read/act endpoints for humans, while the webhook service is the
 * token-authenticated inbound API.
 *
 * Endpoints degrade gracefully: each one guards its own dependencies and returns
 * 501/500 rather than throwing, so a missing subsystem never takes down the
 * whole dashboard.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';
import { logger, logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { healthCheckService } from '@/services/system/HealthCheckService.js';
import { cacheManager } from '@/core/CacheManager.js';
import type { WhatsAppClient } from '@/core/Client.js';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DashboardConfig {
  enabled: boolean;
  port: number;
}

/** Connection state of the main bot or one sub-bot slot. */
export interface BotInfo {
  id: string;
  name: string;
  connected: boolean;
  phone?: string;
  uptime?: number;
}

/** Aggregate view returned by /api/stats. */
export interface DashboardSnapshot {
  dashboard: DashboardConfig;
  bots: BotInfo[];
  memory: { rss: number; heapTotal: number; heapUsed: number };
  uptime: number;
}

/** One sample in the rolling metrics window. */
interface RealtimeMetrics {
  timestamp: number;
  messagesPerMinute: number;
  commandsPerMinute: number;
  errorsPerMinute: number;
  memory: { rss: number; heapUsed: number; percentage: number };
  cpu: number;
  activeSubbots: number;
  queueDepth: number;
}

/**
 * Rolling metrics sampler backing /api/metrics/realtime.
 *
 * Counts are given as process-lifetime totals, so they are differenced against
 * elapsed time to derive per-minute rates. Both the history and the rate arrays
 * are capped at 60 entries (one hour of samples).
 */
class MetricsCollector {
  private metricsHistory: RealtimeMetrics[] = [];
  /** Per-minute rates, one entry per sampling minute. */
  private messageCounts: number[] = [];
  private commandCounts: number[] = [];
  private errorCounts: number[] = [];
  private lastCheck = Date.now();

  /**
   * Samples the current state.
   * Rate buckets only advance once at least a minute has elapsed, so repeated
   * calls within the same minute reuse the previous rate.
   */
  recordMetrics(
    messages: number,
    commands: number,
    errors: number,
    memoryRss: number,
    memoryHeap: number,
    activeSubbots: number,
    queueDepth: number,
  ): void {
    const now = Date.now();
    const elapsed = (now - this.lastCheck) / 60000;

    if (elapsed >= 1) {
      this.messageCounts.push(Math.round(messages / elapsed));
      this.commandCounts.push(Math.round(commands / elapsed));
      this.errorCounts.push(Math.round(errors / elapsed));
      this.lastCheck = now;

      if (this.messageCounts.length > 60) {
        this.messageCounts.shift();
        this.commandCounts.shift();
        this.errorCounts.shift();
      }
    }

    const totalMem = os.totalmem();
    const percentage = Math.round((memoryRss / totalMem) * 100);

    this.metricsHistory.push({
      timestamp: now,
      messagesPerMinute:
        this.messageCounts.length > 0 ? this.messageCounts[this.messageCounts.length - 1] : 0,
      commandsPerMinute:
        this.commandCounts.length > 0 ? this.commandCounts[this.commandCounts.length - 1] : 0,
      errorsPerMinute:
        this.errorCounts.length > 0 ? this.errorCounts[this.errorCounts.length - 1] : 0,
      memory: { rss: memoryRss, heapUsed: memoryHeap, percentage },
      cpu: 0,
      activeSubbots,
      queueDepth,
    });

    if (this.metricsHistory.length > 60) {
      this.metricsHistory.shift();
    }
  }

  /** Most recent sample, or null before the first one is recorded. */
  getCurrent(): RealtimeMetrics | null {
    return this.metricsHistory.length > 0
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  /** Copy of the rolling history, newest last. */
  getHistory(): RealtimeMetrics[] {
    return [...this.metricsHistory];
  }

  /** Mean per-minute rate across the sampling window. */
  getAverages(): { messages: number; commands: number; errors: number } {
    const msgs =
      this.messageCounts.length > 0
        ? this.messageCounts.reduce((a, b) => a + b, 0) / this.messageCounts.length
        : 0;
    const cmds =
      this.commandCounts.length > 0
        ? this.commandCounts.reduce((a, b) => a + b, 0) / this.commandCounts.length
        : 0;
    const errs =
      this.errorCounts.length > 0
        ? this.errorCounts.reduce((a, b) => a + b, 0) / this.errorCounts.length
        : 0;
    return { messages: Math.round(msgs), commands: Math.round(cmds), errors: Math.round(errs) };
  }
}

export const metricsCollector = new MetricsCollector();

export class DashboardService {
  private app: Express | null = null;
  private server: ReturnType<Express['listen']> | null = null;
  private config: DashboardConfig = { enabled: false, port: 3001 };
  /** Newest-first ring of panel activity lines, capped at MAX_LOGS. */
  private logs: Array<{ timestamp: number; level: string; message: string }> = [];
  private readonly MAX_LOGS = 100;

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Copy of the current configuration, so callers cannot mutate it. */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /** Applies a partial configuration change and returns the result. */
  setConfig(patch: Partial<DashboardConfig>): DashboardConfig {
    if (patch.enabled !== undefined) this.config.enabled = patch.enabled;
    if (patch.port !== undefined) this.config.port = patch.port;
    return this.getConfig();
  }

  /** Point-in-time view of bots, memory and uptime. */
  getSnapshot(): DashboardSnapshot {
    const memory = process.memoryUsage();
    const bots = this.getBotsInfo();

    return {
      dashboard: this.getConfig(),
      bots,
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
      },
      uptime: process.uptime(),
    };
  }

  /** Appends a panel log line, dropping the oldest once MAX_LOGS is reached. */
  addLog(level: string, message: string): void {
    this.logs.unshift({ timestamp: Date.now(), level, message });
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
  }

  /**
   * Connection state of the main bot plus every occupied sub-bot slot.
   * Free and reserved slots are omitted; failures reading the slot list are
   * logged so the main bot still shows up.
   */
  private getBotsInfo(): BotInfo[] {
    const bots: BotInfo[] = [];

    const mainBotConnected =
      (global as { client?: { isClientReady(): boolean } }).client?.isClientReady() ?? false;
    bots.push({
      id: 'main',
      name: 'VaniaBot',
      connected: mainBotConnected,
      uptime: process.uptime(),
    });

    if (subBotManager) {
      try {
        const allSlots = subBotManager.getAllStatus();
        for (const slot of allSlots) {
          if (slot.status !== 'free' && slot.status !== 'reserved') {
            bots.push({
              id: slot.id || `slot${slot.slot}`,
              name: slot.name || `SubBot ${slot.slot}`,
              connected: slot.status === 'connected',
              phone: slot.phoneNumber,
            });
          }
        }
      } catch (error) {
        logError('[DashboardService]', error);
      }
    }

    return bots;
  } /** Group service accessor that tolerates pre-startup state. */
  private getGroupService() {
    return serviceManager.groupService || null;
  }

  /** Moderation service accessor that tolerates pre-startup state. */
  private getModerationService() {
    return serviceManager.moderationService || null;
  }

  /**
   * Builds the Express app: static panel assets, the JSON API, a SPA fallback
   * and a terminal error handler.
   */
  private createApp(): Express {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use(express.static(path.join(__dirname, '../../../panel')));

    /** Aggregate stats: bots, memory, slots, cache and rolling averages. */
    app.get('/api/stats', (_req: Request, res: Response) => {
      try {
        const snapshot = this.getSnapshot();
        const allSlots = subBotManager?.getAllStatus() || [];
        const usedSlots = allSlots.filter(s => s.status !== 'free').length;
        const connectedSubbots = allSlots.filter(s => s.status === 'connected').length;

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const avgMetrics = metricsCollector.getAverages();

        let cacheStats = { size: 0, hits: 0, misses: 0 };
        try {
          if (cacheManager?.getStats) {
            const stats = cacheManager.getStats();
            const sizes = stats.sizes || {};
            cacheStats = {
              size: Object.values(sizes).reduce((a: number, b: number) => a + b, 0) as number,
              hits: stats.hits || 0,
              misses: stats.misses || 0,
            };
          }
        } catch (error) {
          logError('[DashboardService]', error);
        }

        res.json({
          dashboard: snapshot.dashboard,
          bots: snapshot.bots,
          memory: snapshot.memory,
          memorySystem: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            percentage: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
          },
          uptime: snapshot.uptime,
          slots: {
            total: allSlots.length,
            used: usedSlots,
            available: allSlots.length - usedSlots,
            connected: connectedSubbots,
            details: allSlots,
          },
          webhook: { pending: 0, ready: 0, total: 0 },
          publicRequests: subBotDatabase?.isPublicRequestsEnabled() || false,
          averages: avgMetrics,
          cache: cacheStats,
        });
      } catch (error) {
        logger.error('Error in /api/stats:', error);
        res.status(500).json({ error: String(error), bots: [], stats: null });
      }
    });

    app.get('/api/bots', (_req: Request, res: Response) => {
      res.json(this.getBotsInfo());
    });

    /** Runs the standard health check. */
    app.get('/api/health', async (_req: Request, res: Response) => {
      try {
        const health = await healthCheckService.performHealthCheck();
        res.json(health);
      } catch (error) {
        res.status(500).json({ status: 'error', message: String(error) });
      }
    });

    /** Health check plus host and process details. */
    app.get('/api/health/detailed', async (_req: Request, res: Response) => {
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

    /** Current sample, rolling history and averages. */
    app.get('/api/metrics/realtime', (_req: Request, res: Response) => {
      const current = metricsCollector.getCurrent();
      const history = metricsCollector.getHistory();
      res.json({
        current,
        history,
        averages: metricsCollector.getAverages(),
      });
    });

    /**
     * Per-command execution metrics from the pipeline.
     * Returns the top 50 commands plus aggregate totals; the top-10 slice is
     * provided separately for the dashboard widget.
     */
    app.get('/api/commands/metrics', (_req: Request, res: Response) => {
      const client = (global as { client?: WhatsAppClient }).client;
      const metrics = client?.getStats()?.commandMetrics || new Map();
      const commands: Array<{
        name: string;
        count: number;
        totalTime: number;
        errors: number;
        avgTime: number;
      }> = [];

      const metricsMap = metrics as Map<
        string,
        { count: number; totalTime: number; errors: number }
      >;
      metricsMap.forEach((data, name) => {
        commands.push({
          name,
          count: data.count,
          totalTime: data.totalTime,
          errors: data.errors,
          avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
        });
      });

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

    /** Sub-bot slot inventory and usage counts. */
    app.get('/api/slots', (_req: Request, res: Response) => {
      if (!subBotManager) {
        res.status(501).json({ error: 'SubBotManager not available' });
        return;
      }
      const allSlots = subBotManager.getAllStatus();
      const usedSlots = allSlots.filter(s => s.status !== 'free').length;
      res.json({
        total: allSlots.length,
        used: usedSlots,
        available: allSlots.length - usedSlots,
        connected: allSlots.filter(s => s.status === 'connected').length,
        pending: allSlots.filter(s => s.status === 'pending' || s.status === 'linking').length,
        details: allSlots,
      });
    });

    /** Recycles a slot so its sub-bot reconnects. */
    app.post('/api/slot/:slot/reconnect', async (req: Request, res: Response) => {
      const slotParam = req.params.slot;
      const slot = typeof slotParam === 'string' ? parseInt(slotParam, 10) : 0;
      if (!subBotManager) {
        res.status(501).json({ error: 'SubBotManager not available' });
        return;
      }
      try {
        await subBotManager.resetSlot(slot);
        this.addLog('info', `Slot ${slot} reconnect requested`);
        res.json({ success: true, slot });
      } catch (error) {
        this.addLog('error', `Slot ${slot} reconnect failed: ${error}`);
        res.status(500).json({ error: String(error) });
      }
    });

    /** Releases a slot. Currently the same operation as reconnect (see resetSlot). */
    app.post('/api/slot/:slot/release', async (req: Request, res: Response) => {
      const slotParam = req.params.slot;
      const slot = typeof slotParam === 'string' ? parseInt(slotParam, 10) : 0;
      if (!subBotManager) {
        res.status(501).json({ error: 'SubBotManager not available' });
        return;
      }
      try {
        await subBotManager.resetSlot(slot);
        this.addLog('info', `Slot ${slot} released`);
        res.json({ success: true, slot });
      } catch (error) {
        this.addLog('error', `Slot ${slot} release failed: ${error}`);
        res.status(500).json({ error: String(error) });
      }
    });

    /** Ban list, capped at the first 100 entries. */
    app.get('/api/moderation/bans', async (req: Request, res: Response) => {
      const modService = this.getModerationService();
      if (!modService) {
        res.status(501).json({ error: 'Database not available' });
        return;
      }
      try {
        const db = serviceManager.db;
        if (!db) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const allBans = await db.getAll('bans');
        res.json({ total: allBans.length, bans: allBans.slice(0, 100) });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    /** Mutes, filtered to those that have not expired. */
    app.get('/api/moderation/mutes', async (req: Request, res: Response) => {
      const modService = this.getModerationService();
      if (!modService) {
        res.status(501).json({ error: 'Database not available' });
        return;
      }
      try {
        const db = serviceManager.db;
        if (!db) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const allMutes = await db.getAll<{ expiresAt: number }>('mutes');
        const activeMutes = allMutes.filter(m => m.expiresAt > Date.now());
        res.json({
          total: allMutes.length,
          active: activeMutes.length,
          mutes: activeMutes.slice(0, 100),
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    /** Moderation log, newest first. `limit` is clamped to 100. */
    app.get('/api/moderation/actions', async (req: Request, res: Response) => {
      try {
        const db = serviceManager.db;
        if (!db) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const limit = parseInt(String(req.query.limit || '50'), 10);
        const result = await db.getPaginated('moderation_logs', {
          page: 1,
          limit: Math.min(limit, 100),
          sortBy: 'timestamp',
          sortOrder: 'desc',
        });
        res.json({ total: result.total, actions: result.items });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    /** All configured groups with their feature flags and stats. */
    app.get('/api/groups', async (req: Request, res: Response) => {
      try {
        const groupService = this.getGroupService();
        if (!groupService) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const groups = await groupService.getAllGroups();
        const groupsWithStats = groups.map(g => ({
          jid: g.jid,
          name: g.name,
          isActive: g.isActive,
          onlyAdmin: g.onlyAdmin,
          welcome: g.welcome.enabled,
          goodbye: g.goodbye.enabled,
          antiLink: g.antiLink.enabled,
          antiSpam: g.antiSpam.enabled,
          stats: g.stats,
        }));
        res.json({
          total: groups.length,
          active: groups.filter(g => g.isActive).length,
          groups: groupsWithStats,
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    /** Full configuration for one group. */
    app.get('/api/groups/:jid', async (req: Request, res: Response) => {
      try {
        const groupService = this.getGroupService();
        if (!groupService) {
          res.status(501).json({ error: 'Database not available' });
          return;
        }
        const jid = Array.isArray(req.params.jid) ? req.params.jid[0] : req.params.jid;
        const group = await groupService.getGroup(jid);
        if (!group) {
          res.status(404).json({ error: 'Group not found' });
          return;
        }
        res.json(group);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    /** Recent panel activity lines, newest first. */
    /** Recent panel activity lines, newest first. */
    app.get('/api/logs', (req: Request, res: Response) => {
      const limit = parseInt(String(req.query.limit || '50'), 10);
      res.json({ logs: this.logs.slice(0, limit) });
    });

    /** Hit/miss and size statistics from the main cache manager. */
    app.get('/api/cache/stats', (_req: Request, res: Response) => {
      res.json(cacheManager.getStats());
    });

    /** SPA fallback: any unmatched route serves the panel entry point. */
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../../../panel/index.html'));
    });

    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Dashboard error:', err);
      res.status(500).json({ error: err.message });
    });

    return app;
  }

  /**
   * Starts the HTTP server.
   * No-ops when disabled or already listening, so repeated calls are safe.
   * @rejects If the port cannot be bound.
   */
  async start(): Promise<void> {
    if (!this.config.enabled) return;
    if (this.server) return;

    const app = this.createApp();
    const port = this.config.port;

    this.addLog('info', `Dashboard starting on port ${port}`);

    return new Promise((resolve, reject) => {
      try {
        this.server = app.listen(port, () => {
          logger.info(`Dashboard web iniciado en http://0.0.0.0:${port}`);
          logger.info(`📊 API: http://0.0.0.0:${port}/api/stats`);
          this.addLog('info', `Dashboard running on port ${port}`);
          resolve();
        });

        this.server.on('error', (err: Error) => {
          logger.error('Error iniciando dashboard:', err);
          this.addLog('error', `Dashboard error: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Closes the HTTP server and waits for in-flight requests to drain. */
  async stop(): Promise<void> {
    const server = this.server;
    if (server) {
      this.server = null;
      this.app = null;
      return new Promise(resolve => {
        server.close(() => {
          logger.info('Dashboard web detenido');
          resolve();
        });
      });
    }
  }
}

export const dashboardService = new DashboardService();
