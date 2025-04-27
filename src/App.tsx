import { useState, useEffect } from 'react';
import { Preloader } from './components/Preloader';
import { systemSync } from './lib/system-sync';
import { AppContent } from './components/AppContent';

// Detect iOS device
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  // Function to initialize the app
  const initializeApp = async () => {
    try {
      // Initialize database connection
      await systemSync.initializeDatabase();

      // Initialize WebSocket connection
      await systemSync.initializeWebSocket();

      // Initialize exchange connection
      await systemSync.initializeExchange();

      // Initialize enhanced services for improved trading functionality
      await systemSync.initializeEnhancedServices();

      return true;
    } catch (error) {
      console.error('Failed to initialize app:', error);
      return false;
    }
  };

  useEffect(() => {
    // Only show preloader on initial load, not on visibility changes
    const initialLoad = async () => {
      try {
        // Add a small delay for iOS devices to ensure DOM is fully ready
        if (isIOS) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        await initializeApp();

        // Additional iOS-specific initialization
        if (isIOS) {
          // Force a layout recalculation on iOS
          document.body.style.display = 'none';
          // This forces a reflow
          void document.body.offsetHeight;
          document.body.style.display = '';

          // Add iOS-specific class to body for CSS targeting
          document.body.classList.add('ios-device');
        }
      } finally {
        setIsInitializing(false);
      }
    };

    if (isInitializing) {
      initialLoad();
    }

    // Add a visibility change handler to check WebSocket connection when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isInitializing) {
        // Check if we need to reinitialize the WebSocket
        systemSync.checkWebSocketConnection();

        // For iOS, we need to handle page visibility changes more aggressively
        if (isIOS) {
          // Force redraw on iOS when returning to the app
          document.body.style.opacity = '0.99';
          setTimeout(() => {
            document.body.style.opacity = '1';
          }, 100);
        }
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // iOS-specific event listeners
    if (isIOS) {
      // Handle orientation changes on iOS
      const handleOrientationChange = () => {
        // Force redraw on orientation change
        document.body.style.display = 'none';
        void document.body.offsetHeight;
        document.body.style.display = '';
      };

      window.addEventListener('orientationchange', handleOrientationChange);

      // Clean up iOS-specific event listeners
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    } else {
      // Clean up event listener for non-iOS devices
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isInitializing]);

  // Show preloader only during initial load
  if (isInitializing) {
    return <Preloader />;
  }

  return <AppContent isReady={!isInitializing} />;
}

export default App;
