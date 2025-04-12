import './lib/node-polyfills';  // This must be the first import
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { systemSync } from './lib/system-sync';
import { logService } from './lib/log-service';
import { globalCacheService } from './lib/global-cache-service';
import { ErrorHandler } from './lib/error-handler';
import './index.css';
import './styles/rainbow-effect.css'; // Import rainbow effect styles
import './styles/mobile.css'; // Import mobile-specific styles

// Import test Supabase client for debugging
import './test-supabase';

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

    // Create root element if it doesn't exist
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }

    // Initialize log service first
    try {
      await logService.initialize();
      console.log('Main: Log service initialized');
    } catch (logError) {
      console.warn('Main: Log service initialization failed:', logError);
    }

    // Initialize global cache service
    try {
      await globalCacheService.initialize();
      console.log('Main: Global cache service initialized');
    } catch (cacheError) {
      console.warn('Main: Cache service initialization failed:', cacheError);
    }

    // Create root and render loading state
    if (!root) {
      root = createRoot(rootElement);
    }

    console.log('Main: Rendering initial loading state...');
    root.render(
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0c',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#FF1493',
            borderBottomColor: '#FF1493',
            margin: '0 auto',
            animation: 'spin 1s linear infinite'
          }}></div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF1493', marginTop: '16px' }}>Initializing...</h2>
          <p style={{ color: '#9ca3af', marginTop: '8px' }}>Please wait while the application loads...</p>
        </div>
      </div>
    );

    // Small delay to ensure loading state is visible
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Main: Rendering main application...');
    root.render(
      <StrictMode>
        <ErrorBoundary
          fallback={
            <div style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0a0a0c'
            }}>
              <div style={{
                textAlign: 'center',
                padding: '24px',
                backgroundColor: '#1f1f23',
                borderRadius: '12px',
                border: '1px solid #2a2b30'
              }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF1493' }}>Application Error</h2>
                <p style={{ color: '#9ca3af', marginTop: '8px' }}>Failed to initialize application</p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#FF1493',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          }
        >
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error) {
    console.error('Main: Fatal initialization error:', error);
    if (root) {
      root.render(
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0c'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '24px',
            backgroundColor: '#1f1f23',
            borderRadius: '12px',
            border: '1px solid #2a2b30'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF1493' }}>Critical Error</h2>
            <p style={{ color: '#9ca3af', marginTop: '8px' }}>{error instanceof Error ? error.message : 'Failed to initialize application'}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: '#FF1493',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
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
