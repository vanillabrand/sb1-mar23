export class CleanupManager {
  private static cleanupTasks: (() => Promise<void>)[] = [];

  static register(cleanup: () => Promise<void>) {
    this.cleanupTasks.push(cleanup);
  }

  static async cleanup() {
    try {
      await Promise.all(this.cleanupTasks.map(task => task()));
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// Register cleanup handlers
CleanupManager.register(() => marketService.cleanup());
CleanupManager.register(() => tradeManager.cleanup());
CleanupManager.register(() => backgroundProcessManager.cleanup());