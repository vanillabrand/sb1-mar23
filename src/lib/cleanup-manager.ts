import { logService } from './log-service';
import { systemSync } from './system-sync';
import { analyticsService } from './analytics-service';
import { templateManager } from './template-manager';
import { tradeEngine } from './trade-engine';

export class CleanupManager {
  private static cleanupTasks: (() => Promise<void>)[] = [];
  private static readonly CLEANUP_TIMEOUT = 5000; // 5 seconds timeout

  static register(cleanup: () => Promise<void>) {
    this.cleanupTasks.push(cleanup);
  }

  static async cleanup(): Promise<boolean> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cleanup timeout')), this.CLEANUP_TIMEOUT);
      });

      // Execute cleanup tasks sequentially to ensure order
      for (const task of this.cleanupTasks) {
        await Promise.race([task(), timeoutPromise]);
      }

      logService.log('info', 'Cleanup completed successfully', null, 'CleanupManager');
      return true;
    } catch (error: unknown) {
      logService.log('error', 'Cleanup failed', error, 'CleanupManager');
      return false;
    }
  }
}

// Register cleanup handlers
CleanupManager.register(() => systemSync.cleanup());
CleanupManager.register(() => analyticsService.cleanup());
CleanupManager.register(() => templateManager.cleanup());
CleanupManager.register(() => tradeEngine.cleanup());

// Handle application shutdown based on environment
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', async (event) => {
    event.preventDefault();
    await CleanupManager.cleanup();
  });
} else {
  // Node.js process handling
  process.on('SIGTERM', async () => {
    await CleanupManager.cleanup();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await CleanupManager.cleanup();
    process.exit(0);
  });
}
