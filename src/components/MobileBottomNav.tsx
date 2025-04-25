import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  LineChart,
  BarChart3,
  Menu
} from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { supabase } from '../lib/supabase';

interface MobileBottomNavProps {
  onMenuToggle: () => void;
}

export function MobileBottomNav({ onMenuToggle }: MobileBottomNavProps) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Use React's useState and useEffect for responsive behavior instead of direct window check
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Force clear any cached user data
      localStorage.removeItem('supabase.auth.token');

      // Force a page reload to ensure all state is cleared
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (error) {
      console.error('Error during sign out:', error);
      // Still try to sign out even if there's an error
      await supabase.auth.signOut();
      localStorage.removeItem('supabase.auth.token');
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
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
        className="mobile-bottom-nav"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
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
          to="/analytics"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-lg ${
              isActive ? 'text-neon-yellow' : 'text-gray-400'
            }`
          }
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-xs mt-1">Analytics</span>
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
