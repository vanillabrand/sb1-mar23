import React from 'react';
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

export const AppContent = () => {
  const { user } = useAuth();

  // If user is not authenticated, show public routes
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // If user is authenticated, show protected routes with sidebar
  return (
    <div className="flex h-screen bg-gunmetal-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
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
      </main>
    </div>
  );
};
