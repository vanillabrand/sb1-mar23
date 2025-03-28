import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { LoadingScreen } from './LoadingScreen';
import { Dashboard } from './Dashboard';
import { StrategyManager } from './StrategyManager';
import { ExchangeManager } from './ExchangeManager';
import { TradeMonitor } from './TradeMonitor';
import { Backtester } from './Backtester';
import { Analytics } from './Analytics';
import { Documentation } from './Documentation';
import { Notes } from './Notes';
import { Settings } from './Settings';
import { BugTracker } from './BugTracker';

interface AppContentProps {
  isReady?: boolean; // Made optional with default value
}

export const AppContent: React.FC<AppContentProps> = ({ isReady = true }) => { // Added default value
  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-screen bg-gunmetal-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/strategy-manager" element={<StrategyManager />} />
          <Route path="/exchange-manager" element={<ExchangeManager />} />
          <Route path="/trade-monitor" element={<TradeMonitor />} />
          <Route path="/backtest" element={<Backtester />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/bug-tracker" element={<BugTracker />} />
        </Routes>
      </main>
    </div>
  );
};
