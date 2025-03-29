import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { KilnLogo } from './KilnLogo';
import {
  LayoutDashboard,
  LineChart,
  Settings,
  Brain,
  History,
  BookOpen,
  StickyNote,
  AlertCircle,
  Building2,
  Monitor,
  Bug,
  LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { strategyService } from '../lib/strategy-service';
import { logService } from '../lib/log-service';

interface NavItemProps {
  to?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick, className }) => {
  const baseClass = `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${className || ''}`;
  
  if (to) {
    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          `${baseClass} ${
            isActive
              ? 'bg-gunmetal-800 text-neon-turquoise'
              : 'text-gray-400 hover:text-white hover:bg-gunmetal-800/50'
          }`
        }
      >
        {icon}
        <span>{label}</span>
      </NavLink>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClass} text-gray-400 hover:text-white hover:bg-gunmetal-800/50`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      // Get all active strategies
      const activeStrategies = await strategyService.getActiveStrategies();

      // Move active strategies to backend process
      for (const strategy of activeStrategies) {
        await strategyService.moveToBackend(strategy.id);
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Navigate to home page
      navigate('/');
      
      logService.log('info', 'User signed out successfully', null, 'Sidebar');
    } catch (error) {
      logService.log('error', 'Error during sign out:', error, 'Sidebar');
      // Still try to sign out and redirect even if there's an error
      await supabase.auth.signOut();
      navigate('/');
    }
  };

  return (
    <div className="w-64 h-screen bg-gunmetal-900/95 backdrop-blur-xl border-r border-gunmetal-800 p-4 flex flex-col">
      <div className="px-4 py-3 mb-6">
        <KilnLogo />
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem
          to="/dashboard"
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Dashboard"
        />
        <NavItem
          to="/strategy-manager"
          icon={<Brain className="w-5 h-5" />}
          label="Strategy Manager"
        />
        <NavItem
          to="/exchange-manager"
          icon={<Building2 className="w-5 h-5" />}
          label="Exchange Manager"
        />
        <NavItem
          to="/trade-monitor"
          icon={<Monitor className="w-5 h-5" />}
          label="Trade Monitor"
        />
        <NavItem
          to="/backtest"
          icon={<History className="w-5 h-5" />}
          label="Backtest"
        />
        <NavItem
          to="/analytics"
          icon={<LineChart className="w-5 h-5" />}
          label="Analytics"
        />
        <NavItem
          to="/documentation"
          icon={<BookOpen className="w-5 h-5" />}
          label="Documentation"
        />
        <NavItem
          to="/notes"
          icon={<StickyNote className="w-5 h-5" />}
          label="Notes"
        />
        <NavItem
          to="/settings"
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
        />
        <NavItem
          to="/bug-tracker"
          icon={<Bug className="w-5 h-5" />}
          label="Bug Tracker"
        />
      </nav>

      <div className="pt-4 border-t border-gunmetal-800">
        <NavItem
          icon={<LogOut className="w-5 h-5" />}
          label="Sign Out"
          onClick={handleSignOut}
          className="text-red-400 hover:text-red-300"
        />
      </div>
    </div>
  );
};
