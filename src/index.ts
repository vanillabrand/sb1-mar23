import { backgroundProcessManager } from './lib/background-process-manager';

async function startBackgroundProcess() {
  try {
    await backgroundProcessManager.start();
    console.log('Background process started successfully');
  } catch (error) {
    console.error('Failed to start background process:', error);
    process.exit(1);
  }
}

startBackgroundProcess();