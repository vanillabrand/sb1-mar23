import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AppContent } from './components/AppContent';
import { NetworkErrorProvider } from './components';
import { systemSync } from './lib/system-sync';
import { analyticsService } from './lib/analytics-service';
import { templateManager } from './lib/template-manager';

import { demoTradeGenerator } from './lib/demo-trade-generator';
import { tradeGenerator } from './lib/trade-generator';
import { tradeEngine } from './lib/trade-engine';
import { demoService } from './lib/demo-service';
import { walletBalanceService } from './lib/wallet-balance-service';
import { strategyUpdateService } from './lib/strategy-update-service';
// dbSchemaFixer removed as it's not needed
import { Preloader } from './components/Preloader';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';

function App() {
  const { user } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initStep, setInitStep] = useState<string>('');

  const navigate = useNavigate();

  const initializeApp = async () => {
    try {
      setIsInitializing(true);
      setInitError(null);

      console.log('App: Starting initialization process');

      // Check authentication first
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError) {
          console.error('App: Authentication error:', authError);
          throw authError;
        }

        if (!session) {
          console.log('App: No session found, navigating to login');
          navigate('/login');
          return;
        }

        console.log('App: Authentication check passed');
      } catch (authCheckError) {
        console.error('App: Authentication check failed', authCheckError);
        // Continue with initialization even if auth check fails
        // This allows the app to initialize in demo mode
      }

      // Initialize core services with better error handling
      const services = [
        { name: 'database', fn: async () => {
          await systemSync.initializeDatabase();
          // Fix database schema issues if needed
          console.log('App: Database schema initialized');
        } },
        { name: 'websocket', fn: () => systemSync.initializeWebSocket() },
        { name: 'exchange', fn: () => systemSync.initializeExchange() },
        { name: 'analytics', fn: () => analyticsService.initialize() },
        { name: 'templates', fn: async () => {
          await templateManager.initialize();
          // Force generation of demo templates
          await templateManager.generateDemoTemplatesIfNeeded();
        } },
        { name: 'trading', fn: () => tradeEngine.initialize() },
        { name: 'wallet', fn: () => walletBalanceService.initialize() },
        { name: 'demo', fn: () => Promise.resolve(demoService.isInDemoMode()) },
        { name: 'tradeGenerator', fn: async () => {
          if (!demoService.isInDemoMode()) {
            console.log('App: Initializing trade generator for normal mode');
            await tradeGenerator.initialize();
            return true;
          }
          return false;
        }},
        { name: 'demoTrading', fn: async () => {
          if (demoService.isInDemoMode()) {
            console.log('App: Initializing demo trade generator for demo mode');
            await demoTradeGenerator.initialize();
            return true;
          }
          return false;
        }},
        { name: 'strategyUpdates', fn: async () => {
          console.log('App: Initializing strategy update service');
          await strategyUpdateService.initialize();
          return true;
        }}
      ];

      for (const service of services) {
        setInitStep(service.name);
        console.log(`App: Starting initialization of ${service.name}`);

        try {
          if (service.name === 'analytics') {
            try {
              await Promise.race([
                service.fn(),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Analytics initialization timed out')), 10000)
                )
              ]);
            } catch (analyticsError) {
              console.warn('App: Analytics initialization timed out, continuing without analytics');
              // Don't rethrow - analytics is non-critical
            }
          } else {
            await service.fn();
          }
          console.log(`App: ${service.name} initialized successfully`);
        } catch (error) {
          console.error(`App: Error initializing ${service.name}:`, error);

          if (['database', 'exchange'].includes(service.name)) {
            console.log('App: Critical service failed, attempting demo mode');
            await systemSync.initializeDemoMode();
            setIsAppReady(true);
            return;
          }
        }
      }

      console.log('App: All services initialized successfully');
      setIsAppReady(true);
    } catch (error) {
      console.error('App: Critical initialization error:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    console.log('App: User state changed:', user ? 'logged in' : 'not logged in');

    if (user) {
      // User is logged in, initialize the app
      initializeApp();
    } else {
      // If no user, we're still technically "ready" for the login screen
      setIsInitializing(false);
      setIsAppReady(true);
    }
  }, [user]);

  // Add a second effect to handle navigation when user state changes
  useEffect(() => {
    if (user) {
      console.log('App: User logged in, checking current path');
      // If we're on the login page and user is logged in, redirect to dashboard
      if (window.location.pathname === '/login') {
        console.log('App: Redirecting from login to dashboard');
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleRetry = () => {
    if (user) {
      initializeApp();
    }
  };

  // Show preloader while checking authentication
  if (isInitializing) {
    return <Preloader />;
  }

  // Show error screen if initialization failed
  if (initError) {
    const isProxyError = initError.includes('Proxy server is not available');

    return (
      <div className="min-h-screen flex items-center justify-center bg-gunmetal-950">
        <div className="text-center space-y-4 p-6 bg-gunmetal-900 rounded-xl border border-gunmetal-800 max-w-lg">
          <h2 className="text-xl font-bold text-neon-pink">
            {isProxyError ? 'Running in Offline Demo Mode' : 'Initialization Error'}
          </h2>
          <p className="text-gray-400 break-words">
            {isProxyError
              ? 'The trading proxy server is currently unavailable. The application will run in offline demo mode.'
              : initError}
          </p>
          <div className="text-sm text-gray-500 mt-2">
            {isProxyError
              ? 'You can still explore the application features in demo mode.'
              : `Failed during ${initStep} initialization. Please check your connection and credentials.`}
          </div>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-neon-pink hover:bg-neon-pink/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render main app content
  return (
    <NetworkErrorProvider>
      <AppContent isReady={isAppReady} />
    </NetworkErrorProvider>
  );
}

export default App;
