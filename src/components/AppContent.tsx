import React, { useState, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import PageTransition from './PageTransition';
import { useAuth } from '../hooks/useAuth';
import { AuthGuard } from './AuthGuard';
import { Sidebar } from './Sidebar';
import { Hero } from './Hero';
import { Dashboard } from './Dashboard';
import { StrategyManager } from './StrategyManager';
import { ExchangeManager } from './ExchangeManager';
import { TradeMonitor } from './TradeMonitor';
import { Backtester } from './Backtester';
import { Analytics } from './Analytics';
import { RiskManagerPage } from './RiskManagerPage';
import PerformancePage from '../pages/PerformancePage';
import { MobileBottomNav } from './MobileBottomNav';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { TradeDebugMonitor } from './TradeDebugMonitor';


interface AppContentProps {
  isReady?: boolean;
}

export const AppContent = ({ isReady = true }: AppContentProps) => {
  const { user } = useAuth();
  const { isMobile } = useMobileDetect();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Import the test page
  const TestPage = React.lazy(() => import('../pages/TestPage').then(module => ({ default: module.TestPage })));

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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </LazyMotion>
    );
  }

  // If user is authenticated, show protected routes with sidebar
  return (
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
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={
                <AuthGuard>
                  <PageTransition>
                    <Dashboard strategies={[]} monitoringStatuses={{}} />
                  </PageTransition>
                </AuthGuard>
              } />
            <Route path="/dashboard" element={
              <AuthGuard>
                <PageTransition>
                  <Dashboard strategies={[]} monitoringStatuses={{}} />
                </PageTransition>
              </AuthGuard>
            } />
            <Route path="/strategy-manager" element={
              <AuthGuard>
                <PageTransition>
                  <StrategyManager />
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
                  <TradeMonitor strategies={[]} />
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

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </LazyMotion>

        {/* Mobile Bottom Navigation - Always rendered but only visible on mobile */}
        <MobileBottomNav onMenuToggle={handleMenuToggle} />

        {/* Trade Debug Monitor - Always rendered but toggleable */}
        <TradeDebugMonitor />
      </main>
    </div>
  );
};
