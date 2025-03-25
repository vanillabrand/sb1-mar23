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

// Initialize all trading services
Promise.resolve().then(async () => {
  try {
    // Initialize core services first
    await systemSync.initialize();
    await marketService.initialize();
    
    // Initialize trading components
    await tradeManager.initialize();
    await tradeGenerator.initialize();
    await strategyMonitor.initialize();
  } catch (error) {
    console.warn('Error initializing trading services:', error);
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);