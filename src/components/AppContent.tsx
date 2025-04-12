import React, { useState, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import { MobileBottomNav } from './MobileBottomNav';
import { useMobileDetect } from '../hooks/useMobileDetect';


interface AppContentProps {
  isReady?: boolean;
}

export const AppContent = ({ isReady = true }: AppContentProps) => {
  const { user } = useAuth();
  const { isMobile } = useMobileDetect();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/test-page" element={<Suspense fallback={<div>Loading test page...</div>}><TestPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // If user is authenticated, show protected routes with sidebar
  return (
    <div className="flex flex-col md:flex-row h-screen bg-black">
      <Sidebar isOpen={isSidebarOpen} onToggle={handleMenuToggle} hasBottomNav={isMobile} />
      <main className={`flex-1 overflow-auto bg-black pt-0 md:pt-0 ${isMobile ? 'has-bottom-nav' : ''}`}>
        <Routes>
          <Route path="/" element={
            <AuthGuard>
              <Dashboard strategies={[]} monitoringStatuses={{}} />
            </AuthGuard>
          } />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Dashboard strategies={[]} monitoringStatuses={{}} />
            </AuthGuard>
          } />
          <Route path="/strategy-manager" element={
            <AuthGuard>
              <StrategyManager />
            </AuthGuard>
          } />
          <Route path="/exchange-manager" element={
            <AuthGuard>
              <ExchangeManager />
            </AuthGuard>
          } />
          <Route path="/trade-monitor" element={
            <AuthGuard>
              <TradeMonitor strategies={[]} />
            </AuthGuard>
          } />
          <Route path="/backtest" element={
            <AuthGuard>
              <Backtester />
            </AuthGuard>
          } />
          <Route path="/analytics" element={
            <AuthGuard>
              <Analytics />
            </AuthGuard>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Mobile Bottom Navigation - Always rendered but only visible on mobile */}
        <MobileBottomNav onMenuToggle={handleMenuToggle} />
      </main>
    </div>
  );
};
