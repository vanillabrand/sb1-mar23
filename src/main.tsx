import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InitializationError } from './components/InitializationError';
import './index.css';

const initApp = async () => {
  try {
    console.log('Starting application initialization...');
    
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
  } catch (error) {
    console.error('Application initialization failed:', error);
    const rootElement = document.getElementById('root');
    if (rootElement) {
      createRoot(rootElement).render(<InitializationError />);
    }
  }
};

initApp();
