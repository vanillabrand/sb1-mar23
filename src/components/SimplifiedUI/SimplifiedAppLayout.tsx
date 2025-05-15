import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  Monitor,
  Settings,
  LogOut,
  AlertCircle,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { demoService } from '../../lib/demo-service';
import { logService } from '../../lib/log-service';
import { SimplifiedDashboard } from './SimplifiedDashboard';
import { SimplifiedStrategyManager } from './SimplifiedStrategyManager';
import { SimplifiedTradeMonitor } from './SimplifiedTradeMonitor';
import { SimplifiedSettings } from './SimplifiedSettings';
import { TradingModeIndicator } from '../TradingModeIndicator';

export function SimplifiedAppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(demoService.isDemoMode());

  // Update mobile state on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update demo mode state when it changes
  useEffect(() => {
    const handleDemoModeChange = () => {
      setIsDemoMode(demoService.isDemoMode());
    };

    document.addEventListener('demo:changed', handleDemoModeChange);
    return () => document.removeEventListener('demo:changed', handleDemoModeChange);
  }, []);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      setError('Failed to sign out. Please try again.');
      logService.log('error', 'Failed to sign out', error, 'SimplifiedAppLayout');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gunmetal-950">
      {/* Top Navigation Bar */}
      <header className="bg-gunmetal-900 border-b border-gunmetal-800 p-4 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.svg" alt="Logo" className="h-8 mr-4" />
          <h1 className="text-xl font-bold gradient-text">Trading Platform</h1>
        </div>

        <div className="flex items-center gap-4">
          <TradingModeIndicator showToggle={true} />

          {user && (
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-neon-turquoise transition-colors"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 mx-4 mt-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Side Navigation (Desktop) */}
        {!isMobile && (
          <nav className="w-64 bg-gunmetal-900 border-r border-gunmetal-800 p-4">
            <ul className="space-y-2">
              <NavItem
                to="/dashboard"
                icon={<LayoutDashboard className="w-5 h-5" />}
                label="Dashboard"
                isActive={location.pathname === '/dashboard'}
              />
              <NavItem
                to="/strategies"
                icon={<Brain className="w-5 h-5" />}
                label="Strategies"
                isActive={location.pathname === '/strategies'}
              />
              <NavItem
                to="/trades"
                icon={<Monitor className="w-5 h-5" />}
                label="Trades"
                isActive={location.pathname === '/trades'}
              />
              <NavItem
                to="/settings"
                icon={<Settings className="w-5 h-5" />}
                label="Settings"
                isActive={location.pathname === '/settings'}
              />
            </ul>

            {/* Demo Mode Indicator */}
            <div className="mt-8 p-3 bg-gunmetal-800 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Current Mode:</p>
              <div className={`text-sm font-medium ${isDemoMode ? 'text-neon-yellow' : 'text-neon-turquoise'}`}>
                {isDemoMode ? 'Demo Mode' : 'Live Trading'}
              </div>
            </div>
          </nav>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/dashboard" element={<SimplifiedDashboard />} />
              <Route path="/strategies" element={<SimplifiedStrategyManager />} />
              <Route path="/trades" element={<SimplifiedTradeMonitor />} />
              <Route path="/settings" element={<SimplifiedSettings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      {isMobile && (
        <nav className="bg-gunmetal-900 border-t border-gunmetal-800 p-2">
          <ul className="flex justify-around">
            <MobileNavItem
              to="/dashboard"
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="Dashboard"
              isActive={location.pathname === '/dashboard'}
            />
            <MobileNavItem
              to="/strategies"
              icon={<Brain className="w-5 h-5" />}
              label="Strategies"
              isActive={location.pathname === '/strategies'}
            />
            <MobileNavItem
              to="/trades"
              icon={<Monitor className="w-5 h-5" />}
              label="Trades"
              isActive={location.pathname === '/trades'}
            />
            <MobileNavItem
              to="/settings"
              icon={<Settings className="w-5 h-5" />}
              label="Settings"
              isActive={location.pathname === '/settings'}
            />
          </ul>
        </nav>
      )}
    </div>
  );
}

// Desktop Navigation Item
function NavItem({ to, icon, label, isActive }: { to: string; icon: React.ReactNode; label: string; isActive: boolean }) {
  return (
    <li>
      <Link
        to={to}
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-gunmetal-800 text-neon-turquoise'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gunmetal-800/50'
        }`}
      >
        {icon}
        <span>{label}</span>
      </Link>
    </li>
  );
}

// Mobile Navigation Item
function MobileNavItem({ to, icon, label, isActive }: { to: string; icon: React.ReactNode; label: string; isActive: boolean }) {
  return (
    <li>
      <Link
        to={to}
        className="flex flex-col items-center p-2"
      >
        <div className={`p-2 rounded-full ${isActive ? 'bg-gunmetal-800 text-neon-turquoise' : 'text-gray-400'}`}>
          {icon}
        </div>
        <span className={`text-xs mt-1 ${isActive ? 'text-neon-turquoise' : 'text-gray-400'}`}>{label}</span>
      </Link>
    </li>
  );
}
