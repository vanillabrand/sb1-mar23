import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { systemSync } from './lib/system-sync';
import { marketService } from './lib/market-service';
import { tradeGenerator } from './lib/trade-generator';
import { tradeManager } from './lib/trade-manager';
import { strategyMonitor } from './lib/strategy-monitor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InitializationError } from './components/InitializationError';

// Initialize all trading services
const initializeServices = async (): Promise<void> => {
  try {
    console.log('Starting services initialization...');
    
    // Initialize core services first
    console.log('Initializing core services...');
    await Promise.all([
      systemSync.initialize().catch(e => {
        console.error('systemSync initialization failed:', e);
        throw e;
      }),
      marketService.initialize().catch(e => {
        console.error('marketService initialization failed:', e);
        throw e;
      })
    ]);
    
    // Initialize trading components
    console.log('Initializing trading components...');
    await Promise.all([
      tradeManager.initialize().catch(e => {
        console.error('tradeManager initialization failed:', e);
        throw e;
      }),
      tradeGenerator.initialize().catch(e => {
        console.error('tradeGenerator initialization failed:', e);
        throw e;
      }),
      strategyMonitor.initialize().catch(e => {
        console.error('strategyMonitor initialization failed:', e);
        throw e;
      })
    ]);

    console.log('All services initialized successfully');
  } catch (error: unknown) {
    console.error('Service initialization failed:', error);
    
    // Proper error cleanup
    console.log('Starting cleanup...');
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
    console.log('Starting application initialization...');
    await initializeServices();
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Failed to find root element');
    }
    
    console.log('Rendering application...');
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

console.log('Starting application...');
initApp();
