import { logService } from './log-service';
import { systemSync } from './system-sync';
import { analyticsService } from './analytics-service';
import { templateService } from './template-service';
import { tradeEngine } from './trade-engine';

export class CleanupManager {
  private static cleanupTasks: (() => Promise<void>)[] = [];

  static register(cleanup: () => Promise<void>) {
    this.cleanupTasks.push(cleanup);
  }

  static async cleanup() {
    try {
      await Promise.all(this.cleanupTasks.map(task => task()));
      logService.log('info', 'Cleanup completed successfully', null, 'CleanupManager');
    } catch (error) {
      logService.log('error', 'Cleanup failed', error, 'CleanupManager');
    }
  }
}

// Register cleanup handlers
CleanupManager.register(() => systemSync.cleanup());
CleanupManager.register(() => analyticsService.cleanup());
CleanupManager.register(() => templateService.cleanup());
CleanupManager.register(() => tradeEngine.cleanup());

// Handle application shutdown
window.addEventListener('beforeunload', () => {
  CleanupManager.cleanup();
});
