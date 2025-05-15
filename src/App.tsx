import { useState, useEffect } from 'react';
import { Preloader } from './components/Preloader';
import { systemSync } from './lib/system-sync';
import { AppContent } from './components/AppContent';
import { SimplifiedAppLayout } from './components/SimplifiedUI';

// Detect devices and browsers
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(navigator.userAgent);
const isMobile = isIOS || isAndroid || window.innerWidth < 768;

// Detect Safari browser (both desktop and mobile)
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
  (navigator.userAgent.includes('AppleWebKit') && !navigator.userAgent.includes('Chrome'));

// Set app height variable for Safari
const setAppHeight = () => {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
};

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
        // Add a small delay for mobile devices to ensure DOM is fully ready
        if (isMobile) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Set a maximum timeout for initialization to prevent the preloader from getting stuck
        // Reduce timeout from 10s to 7s for better user experience
        const initializationTimeout = setTimeout(() => {
          console.warn('App initialization timed out, proceeding anyway');
          setIsInitializing(false);

          // Schedule a background initialization attempt after the app has loaded
          setTimeout(() => {
            console.log('Attempting background initialization after timeout');
            initializeApp().catch(error => {
              console.warn('Background initialization failed:', error);
            });
          }, 5000); // Try again 5 seconds after showing the app
        }, 7000); // 7 seconds maximum wait time (reduced from 10s)

        try {
          await initializeApp();
          // Clear the timeout if initialization completes successfully
          clearTimeout(initializationTimeout);
        } catch (initError) {
          console.error('App initialization failed:', initError);
          // Clear the timeout if initialization fails
          clearTimeout(initializationTimeout);
          // Continue anyway to prevent the preloader from getting stuck

          // Schedule a background initialization attempt after the app has loaded
          setTimeout(() => {
            console.log('Attempting background initialization after error');
            initializeApp().catch(error => {
              console.warn('Background initialization failed:', error);
            });
          }, 5000); // Try again 5 seconds after showing the app
        }

        // Browser-specific initialization
        // Add appropriate classes to body for CSS targeting
        if (isIOS) {
          document.body.classList.add('ios-device');
        }
        if (isAndroid) {
          document.body.classList.add('android-device');
        }
        if (isMobile) {
          document.body.classList.add('mobile-device');
        }
        if (isSafari) {
          document.body.classList.add('safari-browser');
        }

        // Set viewport height variable (fixes 100vh issue on mobile)
        const setViewportHeight = () => {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        // Set initial viewport height
        setViewportHeight();

        // Set app height for Safari
        if (isSafari) {
          setAppHeight();

          // Force a layout recalculation for Safari
          document.body.style.display = 'none';
          void document.body.offsetHeight;
          document.body.style.display = '';
        }

        // Update on resize
        window.addEventListener('resize', () => {
          setViewportHeight();
          if (isSafari) {
            setAppHeight();
          }
        });
      } finally {
        setIsInitializing(false);
      }
    };

    if (isInitializing) {
      initialLoad();

      // Add event listener for manual continue button in Preloader
      const handleManualContinue = () => {
        console.log('Manual continue triggered');
        setIsInitializing(false);
      };

      window.addEventListener('manual-continue', handleManualContinue);

      // Clean up event listener
      return () => {
        window.removeEventListener('manual-continue', handleManualContinue);
      };
    }

    // Add a visibility change handler to check WebSocket connection when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isInitializing) {
        // Check if we need to reinitialize the WebSocket
        systemSync.checkWebSocketConnection();

        // For mobile devices and Safari, we need to handle page visibility changes more aggressively
        if (isMobile || isSafari) {
          // Force redraw when returning to the app
          document.body.style.opacity = '0.99';
          setTimeout(() => {
            document.body.style.opacity = '1';

            // Update viewport height on visibility change
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);

            // Update app height for Safari
            if (isSafari) {
              setAppHeight();
            }
          }, 100);
        }
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Mobile and Safari-specific event listeners
    if (isMobile || isSafari) {
      // Handle orientation and resize changes
      const handleOrientationChange = () => {
        // Update viewport height on orientation change
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);

        // Update app height for Safari
        if (isSafari) {
          setAppHeight();
        }

        // Force redraw on orientation change
        setTimeout(() => {
          window.scrollTo(0, 0);
          document.body.style.opacity = '0.99';
          setTimeout(() => {
            document.body.style.opacity = '1';
          }, 50);
        }, 50);
      };

      window.addEventListener('orientationchange', handleOrientationChange);
      window.addEventListener('resize', handleOrientationChange);

      // Safari-specific resize handler
      if (isSafari) {
        // Additional handler for Safari to fix rendering issues
        const handleSafariResize = () => {
          // Force a layout recalculation for Safari
          requestAnimationFrame(() => {
            setAppHeight();
            document.body.style.display = 'none';
            void document.body.offsetHeight;
            document.body.style.display = '';
          });
        };

        window.addEventListener('resize', handleSafariResize);

        // Clean up all event listeners
        return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('orientationchange', handleOrientationChange);
          window.removeEventListener('resize', handleOrientationChange);
          window.removeEventListener('resize', handleSafariResize);
        };
      }

      // Clean up mobile-specific event listeners
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('resize', handleOrientationChange);
      };
    } else {
      // Clean up event listener for non-mobile, non-Safari devices
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isInitializing]);

  // Show preloader only during initial load
  if (isInitializing) {
    return <Preloader />;
  }

  // Show main content when initialization is complete
  // Use the simplified UI instead of the original AppContent
  return <SimplifiedAppLayout />;
}

export default App;
