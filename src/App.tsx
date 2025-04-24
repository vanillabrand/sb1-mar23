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
  }, [isInitializing]);

  // Remove visibility change handling completely
  // The app should maintain its state when switching tabs

  // Show preloader only during initial load
  if (isInitializing) {
    return <Preloader />;
  }

  return <AppContent isReady={!isInitializing} />;
}

export default App;
