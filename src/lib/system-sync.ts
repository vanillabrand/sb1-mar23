import { logService } from './log-service';
import { supabase } from './supabase';
import { exchangeService } from './exchange-service';
import { templateService } from './template-service';
import { demoService } from './demo-service';

class SystemSync {
  private initialized = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  async initializeDatabase(): Promise<void> {
    let retryCount = 0;

    while (retryCount < this.MAX_RETRIES) {
      try {
        // Check auth session first - this is the most important check
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(`Session check failed: ${sessionError.message}`);
        }

        // If no session, switch to demo mode
        if (!session) {
          logService.log('info', 'No active session, switching to demo mode', null, 'SystemSync');
          return this.initializeDemoMode();
        }

        // Try a simple query to check if Supabase is available
        try {
          // Try to access a table that should exist
          const { error: tableError } = await supabase
            .from('strategy_templates')
            .select('count')
            .limit(1);

          if (tableError) {
            logService.log('warn', 'Table check failed, but continuing initialization', tableError, 'SystemSync');
            // Don't throw here, just log the warning and continue
          }
        } catch (tableCheckError) {
          // Log but don't fail completely on table check
          logService.log('warn', 'Table check failed with exception', tableCheckError, 'SystemSync');
        }

        // If we got here, basic initialization succeeded
        logService.log('info', 'Database initialization successful', null, 'SystemSync');
        return;

      } catch (error) {
        retryCount++;
        logService.log('warn',
          `Database initialization attempt ${retryCount} failed`,
          error,
          'SystemSync'
        );

        if (retryCount === this.MAX_RETRIES) {
          logService.log('error', 'Database initialization failed after max retries', error, 'SystemSync');
          return this.initializeDemoMode();
        }

        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retryCount));
      }
    }
  }

  async initializeWebSocket(): Promise<void> {
    try {
      // For now, just log success since WebSocket isn't critical
      logService.log('info', 'WebSocket initialization skipped', null, 'SystemSync');
      return;
    } catch (error) {
      logService.log('warn', 'WebSocket initialization failed, continuing anyway', error, 'SystemSync');
      // Don't throw error for WebSocket - treat as non-critical
      return;
    }
  }

  async initializeExchange(): Promise<void> {
    let retryCount = 0;

    while (retryCount < this.MAX_RETRIES) {
      try {
        await exchangeService.initializeExchange({
          name: 'binance',
          apiKey: import.meta.env.VITE_BINANCE_TESTNET_API_KEY,
          secret: import.meta.env.VITE_BINANCE_TESTNET_API_SECRET,
          testnet: true
        });

        logService.log('info',
          `Exchange initialized in ${exchangeService.isDemo() ? 'testnet' : 'live'} mode`,
          null,
          'SystemSync'
        );
        return;

      } catch (error) {
        retryCount++;

        // Check for network or proxy errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('fetch failed') || errorMessage.includes('NetworkError')) {
          logService.log('warn', 'Network error, switching to offline demo mode', error, 'SystemSync');
          return this.initializeDemoMode();
        }

        logService.log('warn',
          `Exchange initialization attempt ${retryCount} failed`,
          error,
          'SystemSync'
        );

        if (retryCount === this.MAX_RETRIES) {
          logService.log('error', 'Exchange initialization failed after max retries', error, 'SystemSync');
          return this.initializeDemoMode();
        }

        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retryCount));
      }
    }
  }

  async initializeDemoMode(): Promise<void> {
    logService.log('info', 'Initializing offline demo mode', null, 'SystemSync');

    try {
      // Initialize demo service first
      if (!demoService.isInDemoMode()) {
        logService.log('info', 'Initializing demo service', null, 'SystemSync');
      }

      // Skip exchange initialization in demo mode to avoid potential errors
      logService.log('info', 'Skipping exchange initialization in demo mode', null, 'SystemSync');

      // Check if user is logged in before initializing templates
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          try {
            // Initialize templates with demo data only for logged-in users
            await templateService.initializeDemoTemplates();
            logService.log('info', 'Demo templates initialized for logged-in user', null, 'SystemSync');
          } catch (templateError) {
            // Don't fail the whole initialization if templates fail
            logService.log('warn', 'Failed to initialize templates, continuing with demo mode', templateError, 'SystemSync');
          }
        } else {
          logService.log('info', 'Skipping template initialization - no logged-in user', null, 'SystemSync');
        }
      } catch (sessionError) {
        logService.log('warn', 'Failed to get session, continuing with demo mode', sessionError, 'SystemSync');
      }

      logService.log('info', 'Offline demo mode initialized successfully', null, 'SystemSync');
      return;
    } catch (error) {
      logService.log('error', 'Demo mode initialization failed', error, 'SystemSync');
      // Don't throw error, just log it and continue
      logService.log('warn', 'Continuing without full demo mode initialization', null, 'SystemSync');
      return;
    }
  }
}

export const systemSync = new SystemSync();
