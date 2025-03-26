import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { systemSync } from '@/lib/system-sync';
import { marketService } from '@/lib/market-service';
import { tradeGenerator } from '@/lib/trade-generator';
import { tradeManager } from '@/lib/trade-manager';
import { strategyMonitor } from '@/lib/strategy-monitor';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InitializationError } from '@/components/InitializationError';

// Initialize all trading services
const initializeServices = async (): Promise<void> => {
  try {
    // Initialize core services first
    await Promise.all([
      systemSync.initialize(),
      marketService.initialize()
    ]);
    
    // Initialize trading components
    await Promise.all([
      tradeManager.initialize(),
      tradeGenerator.initialize(),
      strategyMonitor.initialize()
    ]);
  } catch (error: unknown) {
    // Proper error cleanup
    await Promise.allSettled([
      systemSync.cleanup(),
      marketService.cleanup(),
      tradeManager.cleanup(),
      tradeGenerator.cleanup(),
      strategyMonitor.cleanup()
    ]);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error initializing trading services:', errorMessage);
    throw error;
  }
};

const initApp = async () => {
  try {
    await initializeServices();
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Failed to find root element');
    }
    
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary fallback={<InitializationError />}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error: unknown) {
    console.error('Failed to initialize application:', error);
    
    // Render error UI
    const rootElement = document.getElementById('root');
    if (rootElement) {
      createRoot(rootElement).render(
        <StrictMode>
          <InitializationError 
            error={error instanceof Error ? error.message : 'Failed to initialize application'} 
          />
        </StrictMode>
      );
    }
  }
};

initApp();
