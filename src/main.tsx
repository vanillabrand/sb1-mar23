// Import React first to ensure it's available
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Then import polyfills after React is loaded
import './lib/node-polyfills';

import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { systemSync } from './lib/system-sync';
import { logService } from './lib/log-service';
import { globalCacheService } from './lib/global-cache-service';
import { config } from './lib/config';
import { ErrorHandler } from './lib/error-handler';
import './index.css';
import './styles/rainbow-effect.css'; // Import rainbow effect styles
import './styles/mobile.css'; // Import mobile-specific styles
import './styles/animations.css'; // Import animation styles
import './ios-fixes.css'; // Import iOS-specific fixes

// Removed test Supabase client import to avoid storage key conflicts

// Initialize the global cache service
// This will start background refresh timers for AI Market Insights and News
// The cache will be updated every 15 minutes and shared across all users
console.log('Initializing global cache service...');

let root: ReturnType<typeof createRoot> | null = null;

// Set up global error handlers immediately to catch early errors
ErrorHandler.setupGlobalErrorHandlers();

// Simplified initialization for debugging
const initApp = async () => {
  try {
    console.log('Main: Starting application initialization...');

    // Debug React availability
    console.log('React available:', typeof React);
    console.log('React.useRef available:', typeof React.useRef);
    console.log('BrowserRouter available:', typeof BrowserRouter);

    // Create root element if it doesn't exist
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }

    // Only initialize if not already done
    if (!root) {
      root = createRoot(rootElement);

      // Initialize log service first
      try {
        await logService.initialize();
        console.log('Main: Log service initialized');
        config.logConfig();
      } catch (logError) {
        console.warn('Main: Log service initialization failed:', logError);
      }

      // Render the application with BrowserRouter instead of RouterProvider
      try {
        // Render the actual application
        root.render(
          <StrictMode>
            <ErrorBoundary>
              <BrowserRouter>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </BrowserRouter>
            </ErrorBoundary>
          </StrictMode>
        );
        console.log('Main: Application rendered successfully');
      } catch (error) {
        console.error('Failed to render main application:', error);
      }
    }
  } catch (error) {
    console.error('Main: Failed to initialize application:', error);
    // Handle initialization error
  }
};

// Add global animation style
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Start the application with error handling
initApp().catch(error => {
  console.error('Main: Unhandled initialization error:', error);
  document.body.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0c; color: #FF1493; text-align: center; padding: 20px;">
      <div>
        <h2 style="font-size: 24px; margin-bottom: 16px;">Fatal Error</h2>
        <p style="color: #9ca3af;">A critical error occurred during application startup.</p>
        <button onclick="window.location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #FF1493; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    </div>
  `;
});
