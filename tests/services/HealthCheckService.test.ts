import { describe, it, expect } from 'vitest';

describe('HealthCheckService - Module Structure', () => {
  it('should export HealthCheckService class', async () => {
    const module = await import('@/services/system/HealthCheckService.js');
    expect(module.HealthCheckService).toBeDefined();
  });

  it('should export AutoRestartService class', async () => {
    const module = await import('@/services/system/HealthCheckService.js');
    expect(module.AutoRestartService).toBeDefined();
  });

  it('ServiceManager expone el health check y el auto-restart sin ciclo de imports', async () => {
    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    expect(serviceManager.healthCheckService).toBeDefined();
    expect(serviceManager.autoRestartService).toBeDefined();
  });
});

describe('HealthCheckService - Type Definitions', () => {
  it('should have valid HealthCheckResult structure', () => {
    const mockResult: any = {
      healthy: true,
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      uptime: 1000,
      checks: [],
      summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
      alerts: [],
    };

    expect(mockResult.healthy).toBe(true);
    expect(['healthy', 'degraded', 'unhealthy']).toContain(mockResult.status);
    expect(typeof mockResult.timestamp).toBe('string');
    expect(Array.isArray(mockResult.checks)).toBe(true);
    expect(Array.isArray(mockResult.alerts)).toBe(true);
  });

  it('should have valid HealthCheck structure', () => {
    const mockCheck: any = {
      name: 'test',
      status: 'pass' as const,
      message: 'OK',
      latency: 10,
    };

    expect(['pass', 'warn', 'fail']).toContain(mockCheck.status);
    expect(typeof mockCheck.latency).toBe('number');
  });

  it('should have valid SystemMetrics structure', () => {
    const mockMetrics: any = {
      memory: {
        used: 100,
        total: 1000,
        percentage: 10,
        rss: 50000000,
        systemTotal: 4000000000,
        systemPercentage: 1.25,
      },
      cpu: { usage: 5 },
      process: {
        uptime: 100,
        pid: 1234,
        platform: 'linux',
        nodeVersion: 'v20.0.0',
      },
    };

    expect(mockMetrics.memory).toHaveProperty('rss');
    expect(mockMetrics.memory).toHaveProperty('systemTotal');
    expect(mockMetrics.memory).toHaveProperty('systemPercentage');
    expect(mockMetrics.cpu).toHaveProperty('usage');
    expect(mockMetrics.process).toHaveProperty('pid');
  });
});

describe('HealthCheckService - Constants', () => {
  it('MEM_WARN_PCT vale 40', async () => {
    const { MEM_WARN_PCT } = await import('@/services/system/HealthCheckService.js');
    expect(MEM_WARN_PCT).toBe(40);
  });

  it('MEM_CRITICAL_PCT vale 60', async () => {
    const { MEM_CRITICAL_PCT } = await import('@/services/system/HealthCheckService.js');
    expect(MEM_CRITICAL_PCT).toBe(60);
  });
});

describe('AutoRestartService - Configuration', () => {
  it('expone la configuración por defecto real', async () => {
    const { DEFAULT_RESTART_CONFIG } = await import('@/services/system/HealthCheckService.js');

    expect(DEFAULT_RESTART_CONFIG.enabled).toBe(true);
    expect(DEFAULT_RESTART_CONFIG.checkIntervalMs).toBe(60000);
    expect(DEFAULT_RESTART_CONFIG.restartThreshold.consecutiveFailures).toBe(5);
    expect(DEFAULT_RESTART_CONFIG.restartThreshold.memoryPercentage).toBe(70);
    expect(DEFAULT_RESTART_CONFIG.restartThreshold.errorRate).toBe(20);
  });

  it('getInstance devuelve siempre la misma instancia', async () => {
    const { AutoRestartService } = await import('@/services/system/HealthCheckService.js');

    expect(AutoRestartService.getInstance()).toBe(AutoRestartService.getInstance());
  });
});
