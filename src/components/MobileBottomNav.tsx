import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  LineChart,
  BarChart3,
  Menu,
  History
} from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { websocketService } from '../lib/websocket-service';
import { useMobileDetect } from '../hooks/useMobileDetect';

interface MobileBottomNavProps {
  onMenuToggle: () => void;
}

export function MobileBottomNav({ onMenuToggle }: MobileBottomNavProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Import the useMobileDetect hook instead of implementing our own detection
  const { isMobile } = useMobileDetect();

  const handleSignOut = async () => {
    try {
      logService.log('info', 'Signing out user from mobile nav', null, 'MobileBottomNav');

      // Disconnect from WebSocket
      websocketService.disconnect();

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Force clear all cached user data
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-user');
      localStorage.removeItem('activeExchange');
      localStorage.removeItem('defaultExchange');

      // Clear session storage as well
      sessionStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('sb-auth-token');

      // Force a direct redirect to home page
      window.location.href = '/';

      logService.log('info', 'User signed out successfully from mobile nav', null, 'MobileBottomNav');
    } catch (error) {
      logService.log('error', 'Error during sign out from mobile nav:', error, 'MobileBottomNav');

      // Still try to sign out and redirect even if there's an error
      try {
        await supabase.auth.signOut();
      } catch (e) {
        logService.log('error', 'Failed to sign out from Supabase', e, 'MobileBottomNav');
      }

      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();

      // Force redirect to home page
      window.location.href = '/';
    }
  };

  // Only show on mobile screens
  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onSignOut={handleSignOut}
      />

      {/* Bottom Navigation Bar */}
      <motion.div
        className="mobile-bottom-nav safe-area-inset-bottom"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 10px)'
        }}
      >
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-lg ${
              isActive ? 'text-neon-turquoise' : 'text-gray-400'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-xs mt-1">Dashboard</span>
        </NavLink>

        <NavLink
          to="/strategy-manager"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-lg ${
              isActive ? 'text-neon-raspberry' : 'text-gray-400'
            }`
          }
        >
          <Brain className="w-5 h-5" />
          <span className="text-xs mt-1">Strategies</span>
        </NavLink>

        <NavLink
          to="/trade-monitor"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-lg ${
              isActive ? 'text-neon-orange' : 'text-gray-400'
            }`
          }
        >
          <LineChart className="w-5 h-5" />
          <span className="text-xs mt-1">Trades</span>
        </NavLink>

        <NavLink
          to="/backtest"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-lg ${
              isActive ? 'text-neon-yellow' : 'text-gray-400'
            }`
          }
        >
          <History className="w-5 h-5" />
          <span className="text-xs mt-1">Backtest</span>
        </NavLink>

        <button
          onClick={() => setIsMenuOpen(true)}
          className="flex flex-col items-center justify-center px-2 py-1 rounded-lg text-gray-400"
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs mt-1">More</span>
        </button>
      </motion.div>
    </>
  );
}
