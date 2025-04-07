import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  LineChart,
  BarChart3,
  Menu
} from 'lucide-react';

interface MobileBottomNavProps {
  onMenuToggle: () => void;
}

export function MobileBottomNav({ onMenuToggle }: MobileBottomNavProps) {
  const location = useLocation();

  // Only show on mobile screens
  if (window.innerWidth >= 768) {
    return null;
  }

  return (
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMenuToggle();
        }}
        className="flex flex-col items-center justify-center px-2 py-1 rounded-lg text-gray-400 hover:text-gray-200 active:text-neon-turquoise"
      >
        <Menu className="w-5 h-5" />
        <span className="text-xs mt-1">More</span>
      </button>
    </motion.div>
  );
}
