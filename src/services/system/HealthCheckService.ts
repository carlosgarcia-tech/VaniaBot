/**
 * HealthCheckService.ts
 *
 * Liveness diagnostics for the bot, exposed through the dashboard and panel.
 *
 * Two services live here:
 * - HealthCheckService runs independent probes (database, session, temp storage,
 *   circuit breakers, memory, AI configuration) in parallel and aggregates them.
 * - AutoRestartService watches the same metrics and asks for a restart when the
 *   process is genuinely unhealthy.
 *
 * Probes never throw: each returns a pass/warn/fail record, so one broken check
 * cannot hide the others.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { circuitBreakerManager } from './CircuitBreakerService.js';
import { serviceManager } from './Servicemanager.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { totalmem } from 'os';
import { logger, logError } from '@/utils/logger.js';

/** Aggregate verdict: healthy only when no probe failed. */
export interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  alerts: HealthAlert[];
}

/** One probe result. */
export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

/** Derived alert, created from failing/warning probes and metric thresholds. */
export interface HealthAlert {
  severity: 'info' | 'warning' | 'critical';
  source: string;
  message: string;
  timestamp: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    /** Process RSS in bytes. */
    rss: number;
    /** Total system RAM in bytes. */
    systemTotal: number;
    /** % of total system RAM consumed by this process. */
    systemPercentage: number;
  };
  cpu: {
    usage: number;
  };
  process: {
    uptime: number;
    pid: number;
    platform: string;
    nodeVersion: string;
  };
  messageStats?: {
    received: number;
    processed: number;
    commands: number;
    errors: number;
    spamBlocked: number;
    avgProcessingTime: number;
  };
}

const START_TIME = Date.now();

/** System RAM percentage above which the health check degrades. */
export const MEM_WARN_PCT = 40;
/** System RAM percentage above which the health check fails. */
export const MEM_CRITICAL_PCT = 60;

export class HealthCheckService {
  private static instance: HealthCheckService;

  private constructor() {}

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Runs every probe concurrently and aggregates the verdict.
   *
   * A warning yields `degraded` rather than `unhealthy`: only a failed probe
   * makes the whole service unhealthy.
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checkPromises: Promise<HealthCheck>[] = [
      this.checkDatabase(),
      Promise.resolve(this.checkSession()),
      Promise.resolve(this.checkTempStorage()),
      Promise.resolve(this.checkCircuitBreakers()),
      Promise.resolve(this.checkMemory()),
      this.checkAIService(),
    ];

    const checks = await Promise.all(checkPromises);

    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      failed: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warn').length,
    };

    const metrics = this.getSystemMetrics();
    const healthy = summary.failed === 0;
    const status = healthy ? (summary.warnings > 0 ? 'degraded' : 'healthy') : 'unhealthy';
    const alerts = this.generateAlerts(checks, metrics);

    return {
      healthy,
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - START_TIME,
      checks,
      summary,
      alerts,
    };
  }

  /**
   * Turns probe results and raw metrics into alerts.
   * Also logs each alert, so a failing health check is visible without opening
   * the dashboard.
   */
  private generateAlerts(checks: HealthCheck[], metrics: SystemMetrics): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    const timestamp = new Date().toISOString();

    for (const check of checks) {
      if (check.status === 'fail') {
        alerts.push({
          severity: 'critical',
          source: check.name,
          message: check.message || 'Check failed',
          timestamp,
        });
        logger.error(`🚨 Health alert [CRITICAL]: ${check.name} - ${check.message}`);
      } else if (check.status === 'warn') {
        alerts.push({
          severity: 'warning',
          source: check.name,
          message: check.message || 'Check warning',
          timestamp,
        });
        logger.warn(`⚠️ Health alert [WARNING]: ${check.name} - ${check.message}`);
      }
    }

    if (metrics.messageStats && metrics.messageStats.errors > 10) {
      alerts.push({
        severity: 'warning',
        source: 'message_stats',
        message: `${metrics.messageStats.errors} errors recorded`,
        timestamp,
      });
    }

    if (metrics.memory.systemPercentage > MEM_CRITICAL_PCT) {
      alerts.push({
        severity: 'critical',
        source: 'memory',
        message: `RAM del sistema al ${metrics.memory.systemPercentage.toFixed(1)}% (rss: ${(metrics.memory.rss / 1024 / 1024).toFixed(0)}MB)`,
        timestamp,
      });
    }

    return alerts;
  }

  /** Database reachability. Failing here makes the bot `unhealthy`. */
  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const db = serviceManager.db;
      const isConnected = db?.isConnected() ?? false;

      if (!isConnected) {
        return {
          name: 'database',
          status: 'fail',
          message: 'Database not connected',
          latency: Date.now() - start,
        };
      }

      return {
        name: 'database',
        status: 'pass',
        message: `Connected to ${db ? (db as unknown as { constructor?: { name?: string } }).constructor?.name || 'database' : 'unknown'}`,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Checks that the credentials file exists and is recent.
   * A missing session is a failure (re-authentication needed); an old one is
   * only a warning, since long-lived sessions are normal.
   */
  private checkSession(): HealthCheck {
    const start = Date.now();
    try {
      const sessionPath = join(process.cwd(), 'vaniasession', 'creds.json');

      if (!existsSync(sessionPath)) {
        return {
          name: 'session',
          status: 'fail',
          message: 'Session file not found',
          latency: Date.now() - start,
        };
      }

      const stats = statSync(sessionPath);
      const age = Date.now() - stats.mtimeMs;
      const oneDay = 24 * 60 * 60 * 1000;

      if (age > oneDay) {
        return {
          name: 'session',
          status: 'warn',
          message: `Session is older than 24h (${Math.round(age / oneDay)} days)`,
          latency: Date.now() - start,
          details: { lastModified: stats.mtime },
        };
      }

      return {
        name: 'session',
        status: 'pass',
        message: 'Session active and recent',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'session',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  /** Temp directory accessibility. Absent is only a warning until something writes. */
  private checkTempStorage(): HealthCheck {
    const start = Date.now();
    try {
      const tempPath = join(process.cwd(), 'data', 'temp');
      if (!existsSync(tempPath)) {
        return {
          name: 'temp_storage',
          status: 'warn',
          message: 'Temp directory does not exist',
          latency: Date.now() - start,
        };
      }
      return {
        name: 'temp_storage',
        status: 'pass',
        message: 'Temp storage accessible',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'temp_storage',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Reports on circuit breakers; any OPEN circuit is a warning naming the
   * affected dependencies, so an external outage is diagnosable at a glance.
   */
  private checkCircuitBreakers(): HealthCheck {
    const start = Date.now();
    try {
      const circuits = circuitBreakerManager.getAllCircuits();
      const circuitNames = Object.keys(circuits);

      if (circuitNames.length === 0) {
        return {
          name: 'circuit_breakers',
          status: 'pass',
          message: 'No circuit breakers active',
          latency: Date.now() - start,
        };
      }

      const openCircuits = circuitNames.filter(name => circuits[name].state === 'OPEN');
      if (openCircuits.length > 0) {
        return {
          name: 'circuit_breakers',
          status: 'warn',
          message: `${openCircuits.length} circuit(s) open: ${openCircuits.join(', ')}`,
          latency: Date.now() - start,
          details: circuits,
        };
      }

      return {
        name: 'circuit_breakers',
        status: 'pass',
        message: `${circuitNames.length} circuit(s) healthy`,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'circuit_breakers',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Measures real process memory (RSS) against total system RAM.
   *
   * Deliberately does NOT use heapUsed/heapTotal: V8 keeps its heap nearly full
   * by design (85-95% is perfectly normal), which would produce constant false
   * positives. Heap figures are still reported in `details` for diagnostics but
   * never drive the verdict.
   */
  private checkMemory(): HealthCheck {
    const start = Date.now();
    const memUsage = process.memoryUsage();
    const rss = memUsage.rss;
    const systemTot = totalmem();
    const sysPct = (rss / systemTot) * 100;

    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(1);
    const rssMB = (rss / 1024 / 1024).toFixed(1);
    const sysTotMB = (systemTot / 1024 / 1024).toFixed(0);

    const details = {
      rss: `${rssMB}MB`,
      systemTotal: `${sysTotMB}MB`,
      systemUsage: `${sysPct.toFixed(1)}%`,
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      heapPct: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)}% (V8 interno, no crítico)`,
    };

    if (sysPct > MEM_CRITICAL_PCT) {
      return {
        name: 'memory',
        status: 'fail',
        message: `RAM crítica: proceso usando ${sysPct.toFixed(1)}% del sistema (${rssMB}MB / ${sysTotMB}MB)`,
        latency: Date.now() - start,
        details,
      };
    }

    if (sysPct > MEM_WARN_PCT) {
      return {
        name: 'memory',
        status: 'warn',
        message: `RAM elevada: proceso usando ${sysPct.toFixed(1)}% del sistema (${rssMB}MB / ${sysTotMB}MB)`,
        latency: Date.now() - start,
        details,
      };
    }

    return {
      name: 'memory',
      status: 'pass',
      message: `RAM OK: ${sysPct.toFixed(1)}% del sistema (${rssMB}MB / ${sysTotMB}MB)`,
      latency: Date.now() - start,
      details,
    };
  }

  /**
   * Reports whether the AI feature is configured.
   * env is imported lazily so this module does not pull the whole config chain
   * into the health path.
   */
  private async checkAIService(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const { env } = await import('@/config/env.js');
      if (!env.GROQ_API_KEY) {
        return {
          name: 'ai_service',
          status: 'warn',
          message: 'AI service not configured (GROQ_API_KEY missing)',
          latency: Date.now() - start,
        };
      }
      return {
        name: 'ai_service',
        status: 'pass',
        message: 'AI service configured',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'ai_service',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Snapshot of memory, CPU and process metrics, plus message statistics when the
   * global client is available. A failure reading the client stats is logged and
   * omitted rather than failing the whole snapshot.
   */
  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const systemTot = totalmem();
    const rss = memUsage.rss;

    const metrics: SystemMetrics = {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        rss,
        systemTotal: systemTot,
        systemPercentage: (rss / systemTot) * 100,
      },
      cpu: {
        usage: process.cpuUsage().user / 1_000_000,
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
    };

    try {
      const client = globalThis.client;
      if (client) {
        const stats = client.getStats();
        metrics.messageStats = {
          received: stats.messagesReceived,
          processed: stats.messagesProcessed,
          commands: stats.commandsExecuted,
          errors: stats.errorsCount,
          spamBlocked: stats.spamBlocked,
          avgProcessingTime: stats.avgProcessingTime,
        };
      }
    } catch (error) {
      logError('[HealthCheckService]', error);
    }

    return metrics;
  }

  /** Full status bundle for the dashboard: health, metrics and circuits. */
  async getDetailedStatus(): Promise<{
    health: HealthCheckResult;
    metrics: SystemMetrics;
    circuits: ReturnType<typeof circuitBreakerManager.getAllCircuits>;
  }> {
    const health = await this.performHealthCheck();
    const metrics = this.getSystemMetrics();
    const circuits = circuitBreakerManager.getAllCircuits();
    return { health, metrics, circuits };
  }
}

export const healthCheckService = HealthCheckService.getInstance();

export interface AutoRestartConfig {
  enabled: boolean;
  checkIntervalMs: number;
  restartThreshold: {
    consecutiveFailures: number;
    /** % of SYSTEM RAM (rss/totalmem), not of the V8 heap. */
    memoryPercentage: number;
    errorRate: number;
  };
}

export const DEFAULT_RESTART_CONFIG: AutoRestartConfig = {
  enabled: true,
  checkIntervalMs: 60_000,
  restartThreshold: {
    consecutiveFailures: 5,
    memoryPercentage: 70,
    errorRate: 20,
  },
};

export class AutoRestartService {
  private static instance: AutoRestartService;
  private config: AutoRestartConfig;
  private consecutiveFailures = 0;
  /** Errors and checks are only compared in windows of 10 (see checkAndRestart). */
  private errorCount = 0;
  private checkCount = 0;
  private restartTimer: ReturnType<typeof setInterval> | null = null;
  private onRestartCallback: (() => void) | null = null;

  private constructor(config: Partial<AutoRestartConfig> = {}) {
    this.config = { ...DEFAULT_RESTART_CONFIG, ...config };
  }

  static getInstance(config?: Partial<AutoRestartConfig>): AutoRestartService {
    if (!AutoRestartService.instance) {
      AutoRestartService.instance = new AutoRestartService(config);
    }
    return AutoRestartService.instance;
  }

  setOnRestartCallback(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  start(): void {
    if (!this.config.enabled) {
      logger.info('Auto-restart service disabled');
      return;
    }
    logger.debug('🚀 Auto-restart service started');
    this.restartTimer = setInterval(() => void this.checkAndRestart(), this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.restartTimer) {
      clearInterval(this.restartTimer);
      this.restartTimer = null;
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    logger.warn(`⚠️ Consecutive failures: ${this.consecutiveFailures}`);
  }

  recordError(): void {
    this.errorCount++;
  }

  /**
   * Decides whether a restart is warranted.
   *
   * Triggers on critical system RAM, too many consecutive failures, or a high
   * error rate over a 10-check window. The last trigger wins, so `reason` always
   * reflects the most recent condition that fired.
   *
   * A restart is only advisory: without a callback the service logs and leaves
   * the bot running, since the in-process restart is disabled.
   */
  private async checkAndRestart(): Promise<void> {
    this.checkCount++;
    const metrics = healthCheckService.getSystemMetrics();

    let shouldRestart = false;
    let reason = '';

    if (metrics.memory.systemPercentage > this.config.restartThreshold.memoryPercentage) {
      shouldRestart = true;
      reason =
        `RAM del sistema crítica: ${metrics.memory.systemPercentage.toFixed(1)}% ` +
        `(${(metrics.memory.rss / 1024 / 1024).toFixed(0)}MB rss)`;
    }

    if (this.consecutiveFailures >= this.config.restartThreshold.consecutiveFailures) {
      shouldRestart = true;
      reason = `${this.consecutiveFailures} fallos consecutivos detectados`;
    }

    if (this.checkCount > 10) {
      const errorRate = (this.errorCount / this.checkCount) * 100;
      if (errorRate > this.config.restartThreshold.errorRate) {
        shouldRestart = true;
        reason = `Tasa de errores alta: ${errorRate.toFixed(1)}%`;
      }
      this.errorCount = 0;
      this.checkCount = 0;
    }

    if (shouldRestart) {
      logger.error(`🚨 AUTO-RESTART triggered: ${reason}`);
      this.stop();
      if (this.onRestartCallback) {
        this.onRestartCallback();
      } else {
        logger.warn('⚠️ Auto-restart triggered but disabled - bot continues running');
      }
    }
  }
}
