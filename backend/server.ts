import { backgroundProcessManager } from '../src/lib/background-process-manager';
import { logService } from '../src/lib/log-service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function startServer() {
  try {
    // Initialize background process manager
    await backgroundProcessManager.start();
    
    // Handle process signals
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
    
    logService.log('info', 'Trading server started successfully', null, 'Server');
  } catch (error) {
    logService.log('error', 'Failed to start trading server', error, 'Server');
    process.exit(1);
  }
}

async function handleShutdown(signal: string) {
  logService.log('info', `Received ${signal}, shutting down gracefully`, null, 'Server');
  
  try {
    await backgroundProcessManager.stop();
    process.exit(0);
  } catch (error) {
    logService.log('error', 'Error during shutdown', error, 'Server');
    process.exit(1);
  }
}

startServer();
