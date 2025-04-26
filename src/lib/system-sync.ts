import { logService } from './log-service';
import { supabase } from './supabase';
import { exchangeService } from './exchange-service';
import { templateService } from './template-service';
import { demoService } from './demo-service';
import { config } from './config';
import { initializeEnhancedServices, cleanupEnhancedServices } from './enhanced-services';

class SystemSync {
  private initialized = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly INITIALIZATION_TIMEOUT = 5000; // 5 seconds timeout for initialization
  private readonly FAST_DEMO_MODE = true; // Enable fast demo mode initialization

  async initializeDatabase(): Promise<void> {
    // If fast demo mode is enabled, skip full database initialization
    if (this.FAST_DEMO_MODE && config.DEMO_MODE) {
      logService.log('info', 'Fast demo mode enabled, skipping full database initialization', null, 'SystemSync');
      return this.initializeDemoMode();
    }

    let retryCount = 0;

    while (retryCount < this.MAX_RETRIES) {
      try {
        // Use Promise.race to add timeout to the initialization
        const sessionPromise = supabase.auth.getSession();

        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Database initialization timed out')), this.INITIALIZATION_TIMEOUT)
          )
        ]);

        if (sessionError) {
          throw new Error(`Session check failed: ${sessionError.message}`);
        }

        // If no session, switch to demo mode
        if (!session) {
          logService.log('info', 'No active session, switching to demo mode', null, 'SystemSync');
          return this.initializeDemoMode();
        }

        // Skip table check if we have a valid session - it's not critical
        // This speeds up initialization significantly

        // If we got here, basic initialization succeeded
        logService.log('info', 'Database initialization successful', null, 'SystemSync');
        return;

      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // If timeout occurred, switch to demo mode immediately
        if (errorMessage.includes('timed out')) {
          logService.log('warn', 'Database initialization timed out, switching to demo mode', error, 'SystemSync');
          return this.initializeDemoMode();
        }

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
      // Connect to the WebSocket server
      const { websocketService } = await import('./websocket-service');

      if (!websocketService.getConnectionStatus()) {
        await websocketService.connect({});
        logService.log('info', 'WebSocket connection established', null, 'SystemSync');
      } else {
        logService.log('info', 'WebSocket already connected', null, 'SystemSync');
      }

      return;
    } catch (error) {
      logService.log('warn', 'WebSocket initialization failed, continuing anyway', error, 'SystemSync');
      // Don't throw error for WebSocket - treat as non-critical
      return;
    }
  }

  /**
   * Check if the WebSocket connection is still alive and reconnect if needed
   */
  async checkWebSocketConnection(): Promise<void> {
    try {
      const { websocketService } = await import('./websocket-service');

      if (!websocketService.getConnectionStatus()) {
        logService.log('info', 'WebSocket connection lost, reconnecting...', null, 'SystemSync');
        await websocketService.reconnect();
      } else {
        // Send a ping to verify the connection
        await websocketService.send({
          type: 'ping',
          timestamp: Date.now(),
          isConnectionCheck: true
        });
        logService.log('debug', 'WebSocket connection verified', null, 'SystemSync');
      }
    } catch (error) {
      logService.log('warn', 'Failed to check WebSocket connection', error, 'SystemSync');

      // Try to reconnect
      try {
        const { websocketService } = await import('./websocket-service');
        await websocketService.reconnect();
      } catch (reconnectError) {
        logService.log('error', 'Failed to reconnect WebSocket', reconnectError, 'SystemSync');
      }
    }
  }

  async initializeExchange(): Promise<void> {
    // If fast demo mode is enabled, skip exchange initialization
    if (this.FAST_DEMO_MODE && config.DEMO_MODE) {
      logService.log('info', 'Fast demo mode enabled, skipping exchange initialization', null, 'SystemSync');
      return;
    }

    let retryCount = 0;

    while (retryCount < this.MAX_RETRIES) {
      try {
        // First, try to initialize from user profile (for cross-device persistence)
        const { userProfileService } = await import('./user-profile-service');
        const savedExchange = await userProfileService.getActiveExchange();

        if (savedExchange && !savedExchange.testnet) {
          logService.log('info', `Found saved exchange in user profile: ${savedExchange.id}`, null, 'SystemSync');

          // Use Promise.race to add timeout to the initialization
          const exchangePromise = exchangeService.initialize();

          await Promise.race([
            exchangePromise,
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Exchange initialization timed out')), this.INITIALIZATION_TIMEOUT)
            )
          ]);

          logService.log('info',
            `Exchange initialized from user profile in ${exchangeService.isDemo() ? 'testnet' : 'live'} mode`,
            null,
            'SystemSync'
          );
          return;
        }

        // If no saved exchange or it's in testnet mode, check if user has any exchanges configured
        const userExchanges = await exchangeService.getUserExchanges();

        if (userExchanges.length > 0) {
          // Find the default exchange or use the first one
          const defaultExchange = userExchanges.find(e => e.is_default) || userExchanges[0];

          if (defaultExchange && !defaultExchange.testnet) {
            logService.log('info', `Using user's exchange: ${defaultExchange.name}`, null, 'SystemSync');

            // Connect to the exchange
            const connectPromise = exchangeService.connect(defaultExchange);

            await Promise.race([
              connectPromise,
              new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('Exchange connection timed out')), this.INITIALIZATION_TIMEOUT)
              )
            ]);

            logService.log('info', `Connected to user's exchange: ${defaultExchange.name}`, null, 'SystemSync');
            return;
          }
        }

        // If no user exchanges found or all are in testnet mode, fall back to demo mode
        logService.log('info', 'No live exchanges found, falling back to demo mode', null, 'SystemSync');

        // Use Promise.race to add timeout to the initialization
        const exchangePromise = exchangeService.initializeExchange({
          name: 'binance',
          apiKey: import.meta.env.VITE_BINANCE_TESTNET_API_KEY,
          secret: import.meta.env.VITE_BINANCE_TESTNET_API_SECRET,
          testnet: true
        });

        await Promise.race([
          exchangePromise,
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Exchange initialization timed out')), this.INITIALIZATION_TIMEOUT)
          )
        ]);

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

        // If timeout or network error occurred, switch to demo mode immediately
        if (errorMessage.includes('timed out') ||
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('NetworkError')) {
          logService.log('warn', 'Network error or timeout, switching to offline demo mode', error, 'SystemSync');
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

        // Use shorter delay for faster initialization
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
  }

  async initializeDemoMode(): Promise<void> {
    logService.log('info', 'Initializing offline demo mode', null, 'SystemSync');

    try {
      // Initialize demo service first - this is the most critical part
      if (!demoService.isInDemoMode()) {
        logService.log('info', 'Initializing demo service', null, 'SystemSync');
      }

      // Skip exchange initialization in demo mode to avoid potential errors
      logService.log('info', 'Skipping exchange initialization in demo mode', null, 'SystemSync');

      // If fast demo mode is enabled, skip template initialization
      if (this.FAST_DEMO_MODE) {
        logService.log('info', 'Fast demo mode enabled, skipping template initialization', null, 'SystemSync');

        // Schedule template initialization to happen after the app is loaded
        setTimeout(() => {
          this.initializeTemplatesInBackground().catch(error => {
            logService.log('warn', 'Background template initialization failed', error, 'SystemSync');
          });
        }, 5000); // 5 seconds after app load

        logService.log('info', 'Offline demo mode initialized successfully (fast mode)', null, 'SystemSync');
        return;
      }

      // Normal demo mode - initialize templates synchronously
      await this.initializeTemplatesInBackground();

      logService.log('info', 'Offline demo mode initialized successfully', null, 'SystemSync');
      return;
    } catch (error) {
      logService.log('error', 'Demo mode initialization failed', error, 'SystemSync');
      // Don't throw error, just log it and continue
      logService.log('warn', 'Continuing without full demo mode initialization', null, 'SystemSync');
      return;
    }
  }

  /**
   * Initialize templates in the background
   * This is extracted to a separate method to allow for deferred initialization
   */
  private async initializeTemplatesInBackground(): Promise<void> {
    try {
      // Check if user is logged in before initializing templates
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
  }
  /**
   * Initialize enhanced services for improved trading functionality
   */
  async initializeEnhancedServices(): Promise<void> {
    try {
      logService.log('info', 'Initializing enhanced services', null, 'SystemSync');

      // Initialize enhanced services
      await initializeEnhancedServices();

      logService.log('info', 'Enhanced services initialized successfully', null, 'SystemSync');
    } catch (error) {
      logService.log('warn', 'Failed to initialize enhanced services, continuing anyway', error, 'SystemSync');
      // Don't throw error - we want to continue even if enhanced services fail
    }
  }

  /**
   * Clean up resources when the system is shutting down
   */
  async cleanup(): Promise<void> {
    try {
      logService.log('info', 'Cleaning up system resources', null, 'SystemSync');

      // Clean up WebSocket connection
      try {
        const { websocketService } = await import('./websocket-service');
        websocketService.cleanup();
      } catch (error) {
        logService.log('warn', 'Failed to clean up WebSocket service', error, 'SystemSync');
      }

      // Clean up enhanced services
      try {
        await cleanupEnhancedServices();
      } catch (error) {
        logService.log('warn', 'Failed to clean up enhanced services', error, 'SystemSync');
      }

      logService.log('info', 'System cleanup completed', null, 'SystemSync');
      return Promise.resolve();
    } catch (error) {
      logService.log('error', 'System cleanup failed', error, 'SystemSync');
      return Promise.resolve(); // Still resolve to allow other cleanup tasks to run
    }
  }
}

export const systemSync = new SystemSync();
