import { serviceManager } from './Servicemanager.js';
import { logger, logError } from '@/utils/logger.js';

/**
 * Service for periodic cleanup of inactive users and expired licenses.
 */
export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private initialCleanupTimer: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;
  private readonly INACTIVITY_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

  /**
   * Starts the cleanup service.
   */
  start(): void {
    if (this.cleanupInterval) {
      logger.warn('CleanupService already running');
      return;
    }

    logger.debug('Cleanup service started');

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

  /**
   * Stops the cleanup service.
   */
  stop(): void {
    if (this.initialCleanupTimer) {
      clearTimeout(this.initialCleanupTimer);
      this.initialCleanupTimer = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Cleanup service stopped');
    }
  }

  /**
   * Performs the cleanup operation.
   * Removes inactive users and disables expired licenses.
   *
   * @returns A promise that resolves when cleanup is complete.
   */
  private async cleanup(): Promise<void> {
    try {
      logger.info('Running cleanup...');

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
            logger.debug(`Removed inactive user: ${user.name}`);
          }),
        ),
      );

      try {
        const licensesDisabled = await serviceManager.licenseService.disableExpiredLicenses();
        if (licensesDisabled > 0) {
          logger.info(`[Cleanup] ${licensesDisabled} expired license(s) disabled`);
        }
      } catch (licenseError) {
        logError('[CleanupService] Error checking licenses:', licenseError);
      }

      if (removedCount > 0) {
        logger.info(`Cleanup completed: ${removedCount} user(s) removed`);
      } else {
        logger.info('Cleanup completed: No users to remove');
      }
    } catch (error) {
      logError('Error during cleanup:', error);
    }
  }

  /**
   * Triggers an immediate manual cleanup.
   *
   * @returns A promise that resolves to the number of removed users.
   */
  async cleanupNow(): Promise<number> {
    logger.info('Running manual cleanup...');
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

    logger.info(`Manual cleanup completed: ${removedCount} user(s) removed`);
    return removedCount;
  }

  /**
   * Removes a specific user by JID.
   *
   * @param jid - The user JID.
   * @returns A promise that resolves to true if removed.
   */
  async removeUser(jid: string): Promise<boolean> {
    try {
      const user = await serviceManager.userService.getUser(jid);
      if (user.isOwner) {
        logger.warn('Cannot remove an owner');
        return false;
      }
      await serviceManager.db.delete('users', jid);
      logger.info(`User removed: ${jid}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets cleanup statistics.
   *
   * @returns A promise that resolves to user statistics.
   */
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