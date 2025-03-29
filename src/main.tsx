import './lib/node-polyfills';  // This must be the first import
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth-context';
import { ErrorBoundary } from './components/ErrorBoundary';
import { systemSync } from './lib/system-sync';
import { logService } from './lib/log-service';
import './index.css';

const CriticalErrorScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gunmetal-950">
    <div className="text-center p-6 bg-gunmetal-900 rounded-xl border border-gunmetal-800">
      <h2 className="text-xl font-bold text-neon-pink">Critical Error</h2>
      <p className="text-gray-400 mt-2">{message}</p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-neon-pink text-white rounded hover:bg-opacity-90 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);

let root: ReturnType<typeof createRoot> | null = null;

const initApp = async () => {
  try {
    // Create root element if it doesn't exist
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }

    // Only create root if it doesn't exist
    if (!root) {
      root = createRoot(rootElement);
    }

    // Render loading state
    root.render(
      <div className="min-h-screen flex items-center justify-center bg-gunmetal-950">
        <div className="text-center p-6">
          <h2 className="text-xl font-bold text-neon-pink">Initializing...</h2>
        </div>
      </div>
    );

    // Initialize services
    console.log('Starting application initialization...');
    await logService.initialize();
    console.log('Log service initialized');

    // Render application
    root.render(
      <StrictMode>
        <ErrorBoundary 
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-gunmetal-950">
              <div className="text-center p-6 bg-gunmetal-900 rounded-xl border border-gunmetal-800">
                <h2 className="text-xl font-bold text-neon-pink">Application Error</h2>
                <p className="text-gray-400 mt-2">Failed to initialize application</p>
              </div>
            </div>
          }
        >
          <BrowserRouter
            future={{ 
              v7_startTransition: true,
              v7_relativeSplatPath: true 
            }}
          >
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error) {
    console.error('Application initialization failed:', error);
    
    // Use existing root if available, otherwise create new one
    if (!root && document.getElementById('root')) {
      root = createRoot(document.getElementById('root')!);
    }
    
    if (root) {
      root.render(
        <CriticalErrorScreen 
          message={error instanceof Error ? error.message : 'Failed to initialize application'} 
        />
      );
    } else {
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #ff69b4; text-align: center; padding: 20px;">
          <div>
            <h2 style="font-size: 24px; margin-bottom: 16px;">Critical Initialization Error</h2>
            <p style="color: #666;">Please check the console for details and refresh the page.</p>
          </div>
        </div>
      `;
    }
  }
};

// Start the application
initApp().catch(error => {
  console.error('Fatal error during initialization:', error);
  document.body.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #ff69b4; text-align: center; padding: 20px;">
      <div>
        <h2 style="font-size: 24px; margin-bottom: 16px;">Fatal Error</h2>
        <p style="color: #666;">A critical error occurred during application startup.</p>
      </div>
    </div>
  `;
});
