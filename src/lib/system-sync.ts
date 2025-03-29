import { logService } from './log-service';
import { supabase } from './supabase-client';
import { exchangeService } from './exchange-service';
import { templateService } from './template-service';

class SystemSync {
  private initialized = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  async initializeDatabase(): Promise<void> {
    let retryCount = 0;
    
    while (retryCount < this.MAX_RETRIES) {
      try {
        // First check if Supabase is available
        const { data: healthCheck, error: healthError } = await supabase
          .from('health_check')
          .select('count')
          .single();

        if (healthError) {
          throw new Error(`Health check failed: ${healthError.message}`);
        }

        // Then check auth session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session check failed: ${sessionError.message}`);
        }

        // If no session, switch to demo mode
        if (!session) {
          logService.log('info', 'No active session, switching to demo mode', null, 'SystemSync');
          return this.initializeDemoMode();
        }

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
          name: 'bitmart',
          apiKey: import.meta.env.VITE_DEMO_EXCHANGE_API_KEY,
          secret: import.meta.env.VITE_DEMO_EXCHANGE_SECRET,
          memo: import.meta.env.VITE_DEMO_EXCHANGE_MEMO,
          testnet: true
        });
        
        logService.log('info', 
          `Exchange initialized in ${exchangeService.isDemo() ? 'demo' : 'live'} mode`, 
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
      // Initialize exchange with demo credentials from environment variables
      await exchangeService.initializeExchange({
        name: 'bitmart',
        apiKey: import.meta.env.VITE_DEMO_EXCHANGE_API_KEY,
        secret: import.meta.env.VITE_DEMO_EXCHANGE_SECRET,
        memo: import.meta.env.VITE_DEMO_EXCHANGE_MEMO,
        testnet: true,
        useUSDX: false
      });

      // Initialize templates with demo data
      await templateService.initializeDemoTemplates();
      
      logService.log('info', 'Offline demo mode initialized successfully', null, 'SystemSync');
    } catch (error) {
      logService.log('error', 'Demo mode initialization failed', error, 'SystemSync');
      throw new Error('Failed to initialize demo mode: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

export const systemSync = new SystemSync();
