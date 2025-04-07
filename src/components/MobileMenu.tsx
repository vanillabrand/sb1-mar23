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
  const menuItems = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-6 h-6" />, label: 'Dashboard' },
    { to: '/strategy-manager', icon: <Brain className="w-6 h-6" />, label: 'Strategies' },
    { to: '/trade-monitor', icon: <Monitor className="w-6 h-6" />, label: 'Trades' },
    { to: '/backtest', icon: <History className="w-6 h-6" />, label: 'Backtest' },
    { to: '/exchange-manager', icon: <Building2 className="w-6 h-6" />, label: 'Exchange' },
    { to: '/risk-manager', icon: <Shield className="w-6 h-6" />, label: 'Risk' }
  ];

  const getIconColor = (label: string) => {
    switch (label) {
      case 'Dashboard': return 'text-neon-turquoise';
      case 'Strategies': return 'text-neon-raspberry';
      case 'Backtest': return 'text-neon-orange';
      case 'Trades': return 'text-neon-orange';
      case 'Risk': return 'text-neon-yellow';
      case 'Exchange': return 'text-neon-turquoise';
      default: return 'text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      {/* Menu Header */}
      <div className="flex items-center justify-between p-4 border-b border-gunmetal-800">
        <h2 className="text-xl font-bold gradient-text">Menu</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gunmetal-800">
          <LogOut className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Menu Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-4 rounded-xl ${
                isActive ? 'bg-gunmetal-800 shadow-inner' : 'bg-gunmetal-900/70'
              }`
            }
          >
            <div className={`${getIconColor(item.label)} mb-2`}>
              {item.icon}
            </div>
            <span className="text-sm font-medium text-center">{item.label}</span>
          </NavLink>
        ))}

        <button
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-gunmetal-900/70"
        >
          <div className="text-[#ff3e8e] mb-2">
            <LogOut className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-center">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
