import React, { useState, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import PageTransition from './PageTransition';
import { useAuth } from '../hooks/useAuth';
import { useExperienceMode, ExperienceModeProvider } from '../hooks/useExperienceMode';
import { AuthGuard } from './AuthGuard';
import { Sidebar } from './Sidebar';
import { Hero } from './Hero';
import { Dashboard } from './Dashboard';
import { AdaptiveDashboard } from './AdaptiveDashboard';
import { StrategyManager } from './StrategyManager';
import { AdaptiveStrategyManager } from './AdaptiveStrategyManager';
import { AdaptiveTradeMonitor } from './AdaptiveTradeMonitor';
import { ExchangeManager } from './ExchangeManager';
import { TradeMonitor } from './TradeMonitor';
import { Backtester } from './Backtester';
import { Analytics } from './Analytics';
import { RiskManagerPage } from './RiskManagerPage';
import { OnboardingExperience } from './OnboardingExperience';
import { ExperienceModeSettings } from './ExperienceModeSettings';
// import { ExperienceModeSwitcher } from './ExperienceModeSwitcher';
// Temporarily disabled adaptive components to fix React hooks error
// import { AdaptiveDashboard } from './AdaptiveDashboard';
// import { AdaptiveStrategyManager } from './AdaptiveStrategyManager';
// import { AdaptiveTradeMonitor } from './AdaptiveTradeMonitor';
// import { AdaptiveSettings } from './AdaptiveSettings';
// import { TestAdaptiveComponents } from './TestAdaptiveComponents';
import PerformancePage from '../pages/PerformancePage';
import { MobileBottomNav } from './MobileBottomNav';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { TradeDebugMonitor } from './TradeDebugMonitor';
// import { StrategyQuickFix } from './StrategyQuickFix'; // Temporarily disabled
import { OptimizedImage } from './OptimizedImage';
import { imageOptimizer } from '../lib/image-optimizer';
import { performanceOptimizer } from '../lib/performance-optimizer';
import { RustApiTest } from './RustApiTest';

// Lazy load ApiStatusIndicator to avoid circular dependencies
const ApiStatusIndicatorLazy = lazy(() => import('./ApiStatusIndicator'));


interface AppContentProps {
  isReady?: boolean;
}

// Inner component that uses experience mode context
const AppContentInner = ({ isReady = true }: AppContentProps) => {
  const { user } = useAuth();
  const { isOnboardingCompleted, completeOnboarding } = useExperienceMode();
  const { isMobile } = useMobileDetect();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();

  // Check if onboarding should be shown
  useEffect(() => {
    if (user && !isOnboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [user, isOnboardingCompleted]);

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Import the test page
  const TestPage = React.lazy(() => import('../pages/TestPage').then(module => ({ default: module.TestPage })));

  // Preload common images
  useEffect(() => {
    // Preload existing images including crypto icons
    const commonImages = [
      '/logo.svg',
      '/vite.svg',
      '/assets/icons/btc.svg',
      '/assets/icons/eth.svg',
      '/assets/icons/usdt.svg'
    ];

    // Use performance optimizer to schedule non-critical tasks
    performanceOptimizer.scheduleTask(() => {
      commonImages.forEach(imageSrc => {
        imageOptimizer.preloadImage(imageSrc, { width: 32, height: 32 });
      });
      return Promise.resolve();
    }, { priority: 'low' });
  }, []);

  // Show loading state if app is not ready
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gunmetal-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-raspberry mx-auto"></div>
          <p className="text-gray-400">Loading application...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show public routes
  if (!user) {
    return (
      <LazyMotion features={domAnimation}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={
              <PageTransition>
                <Hero />
              </PageTransition>
            } />
            <Route path="/test-page" element={
              <PageTransition>
                <Suspense fallback={<div>Loading test page...</div>}>
                  <TestPage />
                </Suspense>
              </PageTransition>
            } />
            <Route path="/rust-api-test" element={
              <PageTransition>
                <RustApiTest />
              </PageTransition>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </LazyMotion>
    );
  }

  // If user is authenticated, show protected routes with sidebar
  return (
    <>
      {/* Show onboarding experience if needed */}
      {showOnboarding && (
        <OnboardingExperience onComplete={handleOnboardingComplete} />
      )}

      <div className="flex flex-col md:flex-row h-screen full-height bg-black" style={{ minHeight: '100%', width: '100%', overflow: 'hidden' }}>
        <Sidebar isOpen={isSidebarOpen} onToggle={handleMenuToggle} hasBottomNav={isMobile} />
        <main className={`flex-1 overflow-auto bg-black pt-0 md:pt-0 ${isMobile ? 'has-bottom-nav' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            position: 'relative',
            zIndex: 1 // Ensure main content is above sidebar on mobile
          }}>

        {/* Global Header - Only visible on desktop */}
        {!isMobile && (
          <div className="bg-gunmetal-900/50 backdrop-blur-sm border-b border-gunmetal-800 py-2 px-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center space-x-2">
              {/* ApiStatusIndicator */}
              <Suspense fallback={<div className="w-12"></div>}>
                <ApiStatusIndicatorLazy />
              </Suspense>
            </div>

            {/* Experience Mode Switcher - Temporarily disabled */}
            {/* <div className="flex items-center space-x-4">
              <ExperienceModeSwitcher />
            </div> */}
          </div>
        )}
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={
                <PageTransition>
                  <Hero />
                </PageTransition>
              } />
              <Route path="/login" element={
                <PageTransition>
                  <Hero />
                </PageTransition>
              } />
              <Route path="/dashboard" element={
                <AuthGuard>
                  <PageTransition>
                    <AdaptiveDashboard />
                  </PageTransition>
                </AuthGuard>
              } />
            <Route path="/strategy-manager" element={
              <AuthGuard>
                <PageTransition>
                  <AdaptiveStrategyManager />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/exchange-manager" element={
              <AuthGuard>
                <PageTransition>
                  <ExchangeManager
                    onExchangeConnect={(exchange) => {
                      console.log('Exchange connected:', exchange);
                    }}
                    onExchangeDisconnect={() => {
                      console.log('Exchange disconnected');
                    }}
                  />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/trade-monitor" element={
              <AuthGuard>
                <PageTransition>
                  <AdaptiveTradeMonitor />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/backtest" element={
              <AuthGuard>
                <PageTransition>
                  <Backtester />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/analytics" element={
              <AuthGuard>
                <PageTransition>
                  <Analytics />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/risk-manager" element={
              <AuthGuard>
                <PageTransition>
                  <RiskManagerPage />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/performance" element={
              <AuthGuard>
                <PageTransition>
                  <PerformancePage />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/settings" element={
              <AuthGuard>
                <PageTransition>
                  <ExperienceModeSettings />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/rust-api-test" element={
              <AuthGuard>
                <PageTransition>
                  <RustApiTest />
                </PageTransition>
              </AuthGuard>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </LazyMotion>

        {/* Mobile Bottom Navigation - Always rendered but only visible on mobile */}
        <MobileBottomNav onMenuToggle={handleMenuToggle} />

        {/* Trade Debug Monitor - Always rendered but toggleable */}
        <TradeDebugMonitor />

        {/* Strategy Quick Fix - Temporarily disabled */}
        {/* <StrategyQuickFix /> */}
      </main>
    </div>
    </>
  );
};

// Main component that provides experience mode context
export const AppContent = ({ isReady = true }: AppContentProps) => {
  return (
    <ExperienceModeProvider>
      <AppContentInner isReady={isReady} />
    </ExperienceModeProvider>
  );
};
