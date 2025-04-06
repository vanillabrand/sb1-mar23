import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  History,
  Building2,
  Monitor,
  Bug,
  LogOut,
  Shield
} from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function MobileMenu({ isOpen, onClose, onSignOut }: MobileMenuProps) {
  if (!isOpen) return null;

  const menuItems = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-6 h-6" />, label: 'Dashboard' },
    { to: '/strategy-manager', icon: <Brain className="w-6 h-6" />, label: 'Strategies' },
    { to: '/backtest', icon: <History className="w-6 h-6" />, label: 'Backtest' },
    { to: '/trade-monitor', icon: <Monitor className="w-6 h-6" />, label: 'Trades' },
    { to: '/risk-manager', icon: <Shield className="w-6 h-6" />, label: 'Risk' },
    { to: '/exchange-manager', icon: <Building2 className="w-6 h-6" />, label: 'Exchange' },
    { to: '/bug-tracker', icon: <Bug className="w-6 h-6" />, label: 'Bugs' }
  ];

  const getIconColor = (label: string) => {
    switch (label) {
      case 'Dashboard': return 'text-neon-pink';
      case 'Strategies': return 'text-neon-yellow';
      case 'Backtest': return 'text-neon-orange';
      case 'Trades': return 'text-neon-turquoise';
      case 'Risk': return 'text-neon-pink';
      case 'Exchange': return 'text-neon-turquoise';
      case 'Bugs': return 'text-gray-200';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      <div className="mobile-menu-grid p-4 pt-16 grid grid-cols-3 gap-3">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => 
              `mobile-menu-item flex flex-col items-center justify-center p-3 rounded-xl ${
                isActive ? 'bg-gunmetal-800/80 shadow-inner' : 'bg-gunmetal-900/50'
              }`
            }
          >
            <div className={`${getIconColor(item.label)} mb-2`}>
              {item.icon}
            </div>
            <span className="text-xs text-center">{item.label}</span>
          </NavLink>
        ))}
        
        <button
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="mobile-menu-item flex flex-col items-center justify-center p-3 rounded-xl bg-gunmetal-900/50"
        >
          <div className="text-[#ff3e8e] mb-2">
            <LogOut className="w-6 h-6" />
          </div>
          <span className="text-xs text-center">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
