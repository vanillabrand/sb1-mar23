import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AppContent } from './components/AppContent';
import { NetworkErrorProvider } from './components';
import { systemSync } from './lib/system-sync';
import { analyticsService } from './lib/analytics-service';
import { templateManager } from './lib/template-manager';
import { performanceMonitor } from './lib/performance-monitor';

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
  const [visibilityState, setVisibilityState] = useState<string>(document.visibilityState);

  const navigate = useNavigate();

  const initializeApp = async () => {
    try {
      setIsInitializing(true);
      setInitError(null);

      // Start measuring initialization time
      performanceMonitor.startMeasurement('app_initialization_total');
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

      // Define service initialization with priority levels
      const criticalServices = [
        { name: 'database', fn: async () => {
          await systemSync.initializeDatabase();
          console.log('App: Database schema initialized');
        }},
        { name: 'demo', fn: () => Promise.resolve(demoService.isInDemoMode()) }
      ];

      const importantServices = [
        { name: 'exchange', fn: () => systemSync.initializeExchange() },
        { name: 'wallet', fn: () => walletBalanceService.initialize() }
      ];

      const secondaryServices = [
        { name: 'websocket', fn: () => systemSync.initializeWebSocket() },
        { name: 'trading', fn: () => tradeEngine.initialize() }
      ];

      const nonCriticalServices = [
        { name: 'analytics', fn: () => analyticsService.initialize(), timeout: 5000 },
        { name: 'templates', fn: async () => {
          // Skip template initialization during startup - it will be done in the background
          console.log('App: Scheduling template initialization for background');
          setTimeout(async () => {
            try {
              await templateManager.initialize();
              await templateManager.generateDemoTemplatesIfNeeded();
              console.log('App: Templates initialized in background');
            } catch (error) {
              console.warn('App: Background template initialization failed', error);
            }
          }, 5000); // 5 seconds after app is ready
        }},
        { name: 'tradeGenerator', fn: async () => {
          if (!demoService.isInDemoMode()) {
            console.log('App: Scheduling trade generator initialization for background');
            setTimeout(async () => {
              try {
                await tradeGenerator.initialize();
                console.log('App: Trade generator initialized in background');
              } catch (error) {
                console.warn('App: Background trade generator initialization failed', error);
              }
            }, 3000);
            return true;
          }
          return false;
        }},
        { name: 'demoTrading', fn: async () => {
          if (demoService.isInDemoMode()) {
            console.log('App: Scheduling demo trade generator initialization for background');
            setTimeout(async () => {
              try {
                await demoTradeGenerator.initialize();
                console.log('App: Demo trade generator initialized in background');
              } catch (error) {
                console.warn('App: Background demo trade generator initialization failed', error);
              }
            }, 3000);
            return true;
          }
          return false;
        }},
        { name: 'strategyUpdates', fn: async () => {
          console.log('App: Scheduling strategy update service initialization for background');
          setTimeout(async () => {
            try {
              await strategyUpdateService.initialize();
              console.log('App: Strategy update service initialized in background');
            } catch (error) {
              console.warn('App: Background strategy update service initialization failed', error);
            }
          }, 4000);
          return true;
        }}
      ];

      // Initialize critical services first - these must succeed
      for (const service of criticalServices) {
        setInitStep(service.name);
        console.log(`App: Starting initialization of critical service: ${service.name}`);
        performanceMonitor.startMeasurement(`critical_service_${service.name}`);

        try {
          await service.fn();
          const duration = performanceMonitor.endMeasurement(`critical_service_${service.name}`);
          console.log(`App: Critical service ${service.name} initialized successfully in ${duration.toFixed(2)}ms`);
        } catch (error) {
          performanceMonitor.endMeasurement(`critical_service_${service.name}`);
          console.error(`App: Error initializing critical service ${service.name}:`, error);
          console.log('App: Critical service failed, attempting demo mode');
          await systemSync.initializeDemoMode();
          setIsAppReady(true);
          return;
        }
      }

      // Initialize important services in parallel
      console.log('App: Starting initialization of important services in parallel');
      performanceMonitor.startMeasurement('important_services');
      try {
        await Promise.all(
          importantServices.map(async (service) => {
            setInitStep(service.name);
            performanceMonitor.startMeasurement(`important_service_${service.name}`);
            try {
              await Promise.race([
                service.fn(),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error(`${service.name} initialization timed out`)), 5000)
                )
              ]);
              const duration = performanceMonitor.endMeasurement(`important_service_${service.name}`);
              console.log(`App: Important service ${service.name} initialized successfully in ${duration.toFixed(2)}ms`);
            } catch (error) {
              performanceMonitor.endMeasurement(`important_service_${service.name}`);
              console.warn(`App: Important service ${service.name} initialization failed, continuing`, error);
              // Don't rethrow - we can continue without these services
            }
          })
        );
        const duration = performanceMonitor.endMeasurement('important_services');
        console.log(`App: All important services initialized in ${duration.toFixed(2)}ms`);
      } catch (error) {
        // This shouldn't happen due to the inner try/catch, but just in case
        performanceMonitor.endMeasurement('important_services');
        console.warn('App: Some important services failed to initialize', error);
      }

      // Initialize secondary services in parallel
      console.log('App: Starting initialization of secondary services in parallel');
      performanceMonitor.startMeasurement('secondary_services');
      try {
        await Promise.all(
          secondaryServices.map(async (service) => {
            setInitStep(service.name);
            performanceMonitor.startMeasurement(`secondary_service_${service.name}`);
            try {
              await Promise.race([
                service.fn(),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error(`${service.name} initialization timed out`)), 3000)
                )
              ]);
              const duration = performanceMonitor.endMeasurement(`secondary_service_${service.name}`);
              console.log(`App: Secondary service ${service.name} initialized successfully in ${duration.toFixed(2)}ms`);
            } catch (error) {
              performanceMonitor.endMeasurement(`secondary_service_${service.name}`);
              console.warn(`App: Secondary service ${service.name} initialization failed, continuing`, error);
              // Don't rethrow - we can continue without these services
            }
          })
        );
        const duration = performanceMonitor.endMeasurement('secondary_services');
        console.log(`App: All secondary services initialized in ${duration.toFixed(2)}ms`);
      } catch (error) {
        // This shouldn't happen due to the inner try/catch, but just in case
        performanceMonitor.endMeasurement('secondary_services');
        console.warn('App: Some secondary services failed to initialize', error);
      }

      // Start non-critical services in parallel but don't wait for them
      console.log('App: Starting initialization of non-critical services in background');
      performanceMonitor.startMeasurement('non_critical_services_start');
      nonCriticalServices.forEach(service => {
        setInitStep(service.name);
        performanceMonitor.startMeasurement(`non_critical_service_${service.name}_start`);
        try {
          // Don't await these - they'll complete in the background
          service.fn().then(() => {
            const duration = performanceMonitor.endMeasurement(`non_critical_service_${service.name}_start`);
            console.log(`App: Non-critical service ${service.name} initialized in background after ${duration.toFixed(2)}ms`);
          }).catch(error => {
            performanceMonitor.endMeasurement(`non_critical_service_${service.name}_start`);
            console.warn(`App: Non-critical service ${service.name} initialization failed`, error);
          });
          console.log(`App: Non-critical service ${service.name} initialization started`);
        } catch (error) {
          performanceMonitor.endMeasurement(`non_critical_service_${service.name}_start`);
          console.warn(`App: Failed to start non-critical service ${service.name}`, error);
        }
      });
      const startDuration = performanceMonitor.endMeasurement('non_critical_services_start');
      console.log(`App: All non-critical services started in ${startDuration.toFixed(2)}ms`);

      console.log('App: All services initialized successfully');

      // End measuring initialization time and report results
      const initTime = performanceMonitor.endMeasurement('app_initialization_total');
      console.log(`App: Total initialization time: ${initTime.toFixed(2)}ms`);
      performanceMonitor.reportAllDurations();

      setIsAppReady(true);
    } catch (error) {
      console.error('App: Critical initialization error:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const newVisibilityState = document.visibilityState;
      console.log(`App: Visibility changed from ${visibilityState} to ${newVisibilityState}`);
      setVisibilityState(newVisibilityState);

      // If the page becomes visible again and was previously hidden
      if (newVisibilityState === 'visible' && visibilityState === 'hidden') {
        console.log('App: Page became visible again');
        // Don't restart initialization if app is already ready
        if (!isAppReady && isInitializing) {
          console.log('App: Resuming initialization after visibility change');
          // Force app to be ready to prevent getting stuck on preloader
          setIsInitializing(false);
          setIsAppReady(true);
        }
      }
    };

    // Add event listener for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [visibilityState, isAppReady, isInitializing]);

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
