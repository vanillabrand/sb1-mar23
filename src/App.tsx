import React, { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoadingScreen } from './components/LoadingScreen';
import { AppContent } from './components/AppContent';
import { logService } from './lib/log-service';
import { systemSync } from './lib/system-sync';
import { analyticsService } from './lib/analytics-service';
import { templateManager } from './lib/template-manager';
import { tradeEngine } from './lib/trade-engine';
import { demoService } from './lib/demo-service';
import { Preloader } from './components/Preloader';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase-client';
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

      // Check authentication first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;

      if (!session) {
        navigate('/login');
        return;
      }

      // Initialize core services in sequence
      const services = [
        { name: 'database', fn: () => systemSync.initializeDatabase() },
        { name: 'websocket', fn: () => systemSync.initializeWebSocket() },
        { name: 'exchange', fn: () => systemSync.initializeExchange() },
        { name: 'analytics', fn: () => analyticsService.initialize() },
        { name: 'templates', fn: () => templateManager.initialize() },
        { name: 'trading', fn: () => tradeEngine.initialize() },
        { name: 'demo', fn: () => Promise.resolve(demoService.isInDemoMode()) }
      ];

      for (const service of services) {
        setInitStep(service.name);
        await service.fn();
        // Add a small delay between service initializations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setIsAppReady(true);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? `${error.name} in ${initStep}: ${error.message}`
        : `Failed to initialize ${initStep}`;

      setInitError(errorMessage);
      logService.log('error', `Failed to initialize ${initStep}`, error, 'App');

      // Check if we should switch to demo mode
      if (initStep === 'database' || initStep === 'exchange') {
        try {
          await systemSync.initializeDemoMode();
          // Ensure demo service is initialized
          if (demoService.isInDemoMode()) {
            logService.log('info', 'Demo mode initialized successfully', null, 'App');
          }
          setIsAppReady(true);
          setInitError(null);
        } catch (demoError) {
          setInitError(`Failed to initialize demo mode: ${demoError instanceof Error ? demoError.message : 'Unknown error'}`);
        }
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (user) {
      initializeApp();
    } else {
      // If no user, we're still technically "ready" for the login screen
      setIsInitializing(false);
      setIsAppReady(true);
    }
  }, [user]);

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
  return <AppContent isReady={isAppReady} />;
}

export default App;
