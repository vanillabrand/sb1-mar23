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
  } catch (error) {
    console.error('Error initializing trading services:', error);
    throw error; // Re-throw to handle at a higher level if needed
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Initialize services before rendering
initializeServices().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}).catch(error => {
  console.error('Failed to initialize application:', error);
  // Consider showing a user-friendly error screen
});
