import { serviceManager } from './Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';

export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private initialCleanupTimer: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;
  private readonly INACTIVITY_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

  start(): void {
    if (this.cleanupInterval) {
      logger.warn('CleanupService ya está corriendo');
      return;
    }

    logger.debug('🧹 Servicio de limpieza iniciado');

    this.initialCleanupTimer = setTimeout(
      () => {
        void this.cleanup().catch(error => {
          logError('[CleanupService] Initial cleanup error', error);
        });
      },
      5 * 60 * 1000,
    );
    this.initialCleanupTimer.unref();

    this.cleanupInterval = setInterval(() => {
      void this.cleanup().catch(error => {
        logError('[CleanupService] Scheduled cleanup error', error);
      });
    }, this.CLEANUP_INTERVAL);
    this.cleanupInterval.unref();
  }

  stop(): void {
    if (this.initialCleanupTimer) {
      clearTimeout(this.initialCleanupTimer);
      this.initialCleanupTimer = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('🧹 Servicio de limpieza detenido');
    }
  }

  private async cleanup(): Promise<void> {
    try {
      logger.info('🧹 Ejecutando limpieza...');

      const now = Date.now();
      const users = await serviceManager.userService.getAllUsers();
      let removedCount = 0;

      const inactiveUsers = users.filter(
        user => !user.isOwner && now - user.updatedAt > this.INACTIVITY_THRESHOLD,
      );
      await Promise.all(
        inactiveUsers.map(user =>
          serviceManager.db.delete('users', user.jid).then(() => {
            removedCount++;
            logger.debug(`🗑️ Usuario inactivo eliminado: ${user.name}`);
          }),
        ),
      );

      try {
        const licensesDisabled = await serviceManager.licenseService.disableExpiredLicenses();
        if (licensesDisabled > 0) {
          logger.info(`[Cleanup] ${licensesDisabled} licencia(s) vencida(s) deshabilitada(s)`);
        }
      } catch (licenseError) {
        logError('[CleanupService] Error verificando licencias:', licenseError);
      }

      if (removedCount > 0) {
        logger.info(`🧹 Limpieza completada: ${removedCount} usuario(s) eliminado(s)`);
      } else {
        logger.info('🧹 Limpieza completada: Sin usuarios para eliminar');
      }
    } catch (error) {
      logError('Error en limpieza:', error);
    }
  }

  async cleanupNow(): Promise<number> {
    logger.info('🧹 Ejecutando limpieza manual...');
    const now = Date.now();
    const users = await serviceManager.userService.getAllUsers();
    let removedCount = 0;

    const inactiveUsers = users.filter(
      user => !user.isOwner && now - user.updatedAt > this.INACTIVITY_THRESHOLD,
    );
    await Promise.all(
      inactiveUsers.map(user =>
        serviceManager.db.delete('users', user.jid).then(() => {
          removedCount++;
        }),
      ),
    );

    logger.info(`🧹 Limpieza manual completada: ${removedCount} usuario(s) eliminado(s)`);
    return removedCount;
  }

  async removeUser(jid: string): Promise<boolean> {
    try {
      const user = await serviceManager.userService.getUser(jid);
      if (user.isOwner) {
        logger.warn('No se puede eliminar a un owner');
        return false;
      }
      await serviceManager.db.delete('users', jid);
      logger.info(`🗑️  Usuario eliminado: ${jid}`);
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{ total: number; active: number; inactive: number; owners: number }> {
    const users = await serviceManager.userService.getAllUsers();
    const now = Date.now();
    let activeCount = 0;
    let inactiveCount = 0;
    let ownerCount = 0;

    for (const user of users) {
      if (user.isOwner) {
        ownerCount++;
        continue;
      }
      const inactiveTime = now - user.updatedAt;
      if (inactiveTime > this.INACTIVITY_THRESHOLD) inactiveCount++;
      else activeCount++;
    }

    return {
      total: users.length,
      active: activeCount,
      inactive: inactiveCount,
      owners: ownerCount,
    };
  }
}

export const cleanupService = new CleanupService();
