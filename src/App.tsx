import { useState, useEffect } from 'react';
import { Preloader } from './components/Preloader';
import { systemSync } from './lib/system-sync';
import { AppContent } from './components/AppContent';

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
        await initializeApp();
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
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up event listener
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitializing]);

  // Show preloader only during initial load
  if (isInitializing) {
    return <Preloader />;
  }

  return <AppContent isReady={!isInitializing} />;
}

export default App;
