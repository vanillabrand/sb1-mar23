import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  History,
  Building2,
  Monitor,
  Bug,
  LogOut,
  Wifi,
  WifiOff,
  Zap,
  CheckCircle,
  Shield,
  XCircle,
  Loader2,
  Circle,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { websocketService } from '../lib/websocket-service';

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  hasBottomNav?: boolean;
}

interface NavItemProps {
  to?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  onMenuClick?: (element: HTMLElement) => void;
  index: number;
  isMobile?: boolean;
  onNavClick?: () => void;
}

// Regular NavItem for desktop
const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick, className, onMenuClick, index, isMobile, onNavClick }) => {
  const navRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const baseClass = `nav-item flex items-center transition-all duration-200 ${isMobile ? 'py-1 border-b border-gray-800' : ''} ${className || ''}`;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    if (onMenuClick && navRef.current) {
      onMenuClick(navRef.current);
    }
    if (onNavClick) {
      onNavClick();
    }
  };

  if (to) {
    return (
      <NavLink
        ref={navRef as React.RefObject<HTMLAnchorElement>}
        to={to}
        onClick={handleClick}
        className={({ isActive }) => {
          // Determine the appropriate color based on the label
          let activeStyles = '';
          let hoverStyles = '';

          if (label === 'Dashboard') {
            activeStyles = 'bg-neon-pink/10 text-neon-pink';
            hoverStyles = 'hover:text-neon-pink';
          } else if (label === 'Strategy Manager') {
            activeStyles = 'bg-neon-yellow/10 text-neon-yellow';
            hoverStyles = 'hover:text-neon-yellow';
          } else if (label === 'Backtest') {
            activeStyles = 'bg-neon-orange/10 text-neon-orange';
            hoverStyles = 'hover:text-neon-orange';
          } else if (label === 'Trade Monitor') {
            activeStyles = 'bg-neon-turquoise/10 text-neon-turquoise';
            hoverStyles = 'hover:text-neon-turquoise';
          } else if (label === 'Risk Manager') {
            activeStyles = 'bg-neon-pink/10 text-neon-pink';
            hoverStyles = 'hover:text-neon-pink';
          } else if (label === 'Exchange Manager') {
            activeStyles = 'bg-neon-turquoise/10 text-neon-turquoise';
            hoverStyles = 'hover:text-neon-turquoise';
          } else if (label === 'Bug Tracker') {
            activeStyles = 'bg-gray-800/50 text-gray-200';
            hoverStyles = 'hover:text-gray-200';
          }

          return `${baseClass} ${isActive
            ? `${activeStyles} font-medium`
            : `text-gray-400 ${hoverStyles}`}`
        }}
        style={{
          animationDelay: `${index * 50}ms`,
          animationDuration: '500ms',
          borderRadius: '8px',
          padding: '12px 16px',
          paddingLeft: '12px',
        }}
      >
        {icon}
        <span className="ml-3">{label}</span>
      </NavLink>
    );
  }

  // For the Sign Out button, use a specific hover color
  const hoverStyles = 'hover:text-[#ff3e8e]';

  return (
    <button
      ref={navRef as React.RefObject<HTMLButtonElement>}
      onClick={handleClick}
      className={`${baseClass} text-gray-400 ${hoverStyles}`}
      style={{
        animationDelay: `${index * 50}ms`,
        animationDuration: '500ms',
        borderRadius: '8px',
        padding: '12px 16px',
      }}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isExchangeDetailsExpanded, setIsExchangeDetailsExpanded] = useState(false);
  // Removed rainbow elements state
  const connectionContainerRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(isOpen || false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isPanelHighlighted, setIsPanelHighlighted] = useState(true);

  // Connection steps state
  const [connectionSteps, setConnectionSteps] = useState([
    { id: 'exchange', name: 'Exchange Connection', status: 'pending', message: '' },
    { id: 'websocket', name: 'WebSocket Connection', status: 'pending', message: '' },
    { id: 'market', name: 'Market Data', status: 'pending', message: '' }
  ]);
  const [latency, setLatency] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Function to highlight the active menu item (simplified, no rainbow effect)
  const highlightMenuItem = (clickedElement: HTMLElement) => {
    // No special highlighting needed anymore
    // This function is kept for compatibility with existing code
  };

  // Retry connection
  const retryConnection = async () => {
    try {
      setIsRetrying(true);

      // Reset all steps to pending
      setConnectionSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: '' })));

      // Start the connection check process
      await checkConnectionStatus();
    } catch (error) {
      console.error('Error during connection retry:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Check connection status
  const checkConnectionStatus = async () => {
    try {
      // For demo purposes, simulate connection steps with mock data
      // In a real app, you would use actual service calls

      // Step 1: Check Exchange Connection
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'exchange' ? { ...step, status: 'in_progress', message: 'Connecting to exchange...' } : step
      ));

      const start = performance.now();

      // Simulate exchange connection (success for demo)
      await new Promise(resolve => setTimeout(resolve, 500));

      setConnectionSteps(prev => prev.map(step =>
        step.id === 'exchange' ? { ...step, status: 'completed', message: 'Exchange connected' } : step
      ));

      // Step 2: Check WebSocket Connection
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'in_progress', message: 'Establishing WebSocket connection...' } : step
      ));

      // Simulate websocket connection (success for demo)
      await new Promise(resolve => setTimeout(resolve, 500));

      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'completed', message: 'WebSocket connected' } : step
      ));

      // Step 3: Check Market Data
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'market' ? { ...step, status: 'in_progress', message: 'Loading market data...' } : step
      ));

      // Simulate market data loading (success for demo)
      await new Promise(resolve => setTimeout(resolve, 500));

      setConnectionSteps(prev => prev.map(step =>
        step.id === 'market' ? { ...step, status: 'completed', message: 'Market data loaded' } : step
      ));

      // All steps completed
      setIsConnected(true);

      // Calculate latency
      const end = performance.now();
      setLatency(Math.round(end - start));

    } catch (error) {
      console.error('Failed to check connection status:', error);
      setIsConnected(false);

      // Find which step was in progress and mark it as error
      setConnectionSteps(prev => {
        const updatedSteps = [...prev];
        const inProgressIndex = updatedSteps.findIndex(step => step.status === 'in_progress');

        if (inProgressIndex !== -1) {
          updatedSteps[inProgressIndex] = {
            ...updatedSteps[inProgressIndex],
            status: 'error',
            message: 'Connection check failed'
          };
        }

        return updatedSteps;
      });
    }
  };

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      // Close mobile menu when resizing to desktop
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    // Call once on mount to set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync with isOpen prop
  useEffect(() => {
    if (isOpen !== undefined) {
      setIsMobileMenuOpen(isOpen);
    }
  }, [isOpen]);

  // Panel highlight effect on page load
  useEffect(() => {
    // Remove highlight after 2 seconds (same duration as the animation)
    const timer = setTimeout(() => {
      setIsPanelHighlighted(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Check connection status
  useEffect(() => {
    // Check connection status initially and every 30 seconds
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 30000);

    // Subscribe to websocket connection events
    const wsConnectedHandler = () => {
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'completed', message: 'WebSocket connected' } : step
      ));
      setIsConnected(true);
    };

    const wsDisconnectedHandler = () => {
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'error', message: 'WebSocket disconnected' } : step
      ));
      setIsConnected(false);
    };

    websocketService.on('connected', wsConnectedHandler);
    websocketService.on('disconnected', wsDisconnectedHandler);

    return () => {
      clearInterval(interval);
      websocketService.off('connected', wsConnectedHandler);
      websocketService.off('disconnected', wsDisconnectedHandler);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      logService.log('info', 'Signing out user', null, 'Sidebar');

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

      // Navigate to home page with replace to prevent back navigation
      navigate('/', { replace: true });

      // Force a page reload to ensure all state is cleared
      window.location.href = '/';

      logService.log('info', 'User signed out successfully', null, 'Sidebar');
    } catch (error) {
      logService.log('error', 'Error during sign out:', error, 'Sidebar');

      // Still try to sign out and redirect even if there's an error
      try {
        await supabase.auth.signOut();
      } catch (e) {
        logService.log('error', 'Failed to sign out from Supabase', e, 'Sidebar');
      }

      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();

      // Force redirect to home page
      window.location.href = '/';
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = (e?: React.MouseEvent) => {
    // Stop event propagation to prevent conflicts
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (onToggle) {
      onToggle();
    }

    // Toggle the mobile menu state
    setIsMobileMenuOpen((prev: boolean) => !prev);

    console.log('Mobile menu toggled, new state:', !isMobileMenuOpen);
  };

  // Contract menu when nav item is clicked
  const contractMenu = () => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className={`${isMobile ? 'w-full shadow-md z-50 mobile-top-nav' : 'w-64 h-screen'} ${isMobile ? 'topnav-metallic' : 'sidebar-metallic'} flex ${isMobile ? 'flex-col' : 'flex-col'} ${isPanelHighlighted ? 'panel-highlight' : ''}`}>
      {/* Logo and Header - Always visible and fully interactive */}
      <div
        className={`${isMobile ? 'w-full px-4 py-0 relative' : 'px-2 py-3 mb-6'} flex items-center ${isMobile ? 'justify-center h-full' : ''}`}
      >
        <div className={`flex items-center ${isMobile ? 'mobile-logo' : ''}`}>
          <div className="rounded-xl bg-gradient-to-br from-green-400 via-yellow-400 to-pink-500 p-0.5">
            <div className="bg-black rounded-xl p-2">
              <Zap className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-yellow-400`} />
            </div>
          </div>
          <div className="ml-3">
            <div className={`${isMobile ? 'text-xl' : 'text-2xl'} gradient-text`}>GIGAntic</div>
            <div className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'} whitespace-nowrap`} style={{ marginTop: "-2px" }}>AI Trading Platform</div>
          </div>
        </div>

        {/* Mobile Menu Toggle Button removed as requested */}
      </div>

      {/* Connection Status Indicator - Conditionally rendered based on mobile state */}
      <div
        className={`${isMobile ? (isMobileMenuOpen ? 'block' : 'hidden') : 'block'} ${isMobile ? 'mb-2' : 'mb-6'} relative z-10 px-6`}
        ref={connectionContainerRef}
      >
        <div
          className={`connection-header flex items-center justify-between px-4 py-2.5 cursor-pointer ${isExchangeDetailsExpanded ? 'rounded-t-lg' : 'rounded-lg'} panel-metallic shadow-md`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExchangeDetailsExpanded(prev => !prev);
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-neon-turquoise" />
              ) : (
                <WifiOff className="w-4 h-4 text-neon-pink" />
              )}
              <span className={`text-sm font-medium ${isConnected ? 'text-neon-turquoise' : 'text-neon-pink'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {latency !== null && isConnected && (
                <span className="text-xs text-neon-turquoise/70 ml-1">{latency}ms</span>
              )}
            </div>
            {/* More/Less text removed as requested */}
          </div>
        </div>

        {/* Expanded Connection Details - Using simple transition */}
        <div
          className={`connection-details mt-0 px-4 py-0 panel-metallic rounded-b-lg text-xs space-y-3 z-20 transition-all duration-300 overflow-hidden ${isExchangeDetailsExpanded ? 'opacity-100 max-h-[500px] py-4' : 'opacity-0 max-h-0 pointer-events-none'}`}
          style={{ marginTop: '-1px', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        >
            {connectionSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-start">
                  <div className={`mt-1 mr-3 rounded-full p-0.5 ${step.status === 'completed' ? 'bg-neon-turquoise/20' : step.status === 'error' ? 'bg-neon-pink/20' : 'bg-gray-800'}`}>
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-neon-turquoise" />
                    ) : step.status === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 text-neon-pink" />
                    ) : step.status === 'in_progress' ? (
                      <Loader2 className="w-3.5 h-3.5 text-neon-yellow animate-spin" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className={`text-xs font-medium ${step.status === 'completed' ? 'text-neon-turquoise' : step.status === 'error' ? 'text-neon-pink' : step.status === 'in_progress' ? 'text-neon-yellow' : 'text-gray-400'}`}>
                      {step.name}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {step.status === 'error' ? step.message || 'Connection failed' :
                       step.status === 'completed' ? step.message || `${step.name.split(' ')[0]} connected` :
                       step.status === 'in_progress' ? 'Connecting...' : 'Waiting...'}
                    </div>
                  </div>
                </div>
                {index < connectionSteps.length - 1 && (
                  <div className={`border-l ml-2 pl-6 -mt-1 pt-1 h-4 ${step.status === 'completed' ? 'border-neon-turquoise/20' : step.status === 'error' ? 'border-neon-pink/20' : 'border-gray-800'}`}></div>
                )}
              </React.Fragment>
            ))}

            {/* Retry button if there's an error */}
            {connectionSteps.some(step => step.status === 'error') && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    retryConnection();
                  }}
                  disabled={isRetrying}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${isRetrying ? 'bg-gray-800 text-gray-400' : 'bg-neon-pink/10 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/20'}`}
                >
                  {isRetrying ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Retrying...</span>
                    </div>
                  ) : 'Retry Connection'}
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Navigation Menu - Conditionally rendered based on mobile state */}
      <nav
        className={`flex flex-1 ${isMobile ? 'px-4 pb-2 pt-0' : ''} ${isMobile ? 'flex-col transition-all duration-300 overflow-hidden' : 'flex-col space-y-2'} ${isMobile && !isMobileMenuOpen ? 'max-h-0 opacity-0' : isMobile ? 'max-h-[1000px] opacity-100' : ''}`}
        style={isMobile ? { transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', marginTop: '-25px' } : {}}
        onClick={(e) => e.stopPropagation()}
      >
        <NavItem
          to="/dashboard"
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Dashboard"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={0}
          isMobile={isMobile}
          className="first-nav-item"
        />
        <NavItem
          to="/strategy-manager"
          icon={<Brain className="w-5 h-5" />}
          label="Strategy Manager"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={1}
          isMobile={isMobile}
        />
        <NavItem
          to="/backtest"
          icon={<History className="w-5 h-5" />}
          label="Backtest"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={2}
          isMobile={isMobile}
        />
        <NavItem
          to="/trade-monitor"
          icon={<Monitor className="w-5 h-5" />}
          label="Trade Monitor"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={3}
          isMobile={isMobile}
        />
        <NavItem
          to="/risk-manager"
          icon={<Shield className="w-5 h-5" />}
          label="Risk Manager"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={4}
          isMobile={isMobile}
        />
        <NavItem
          to="/exchange-manager"
          icon={<Building2 className="w-5 h-5" />}
          label="Exchange Manager"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={5}
          isMobile={isMobile}
        />
        <NavItem
          to="/bug-tracker"
          icon={<Bug className="w-5 h-5" />}
          label="Bug Tracker"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={6}
          isMobile={isMobile}
        />
        <NavItem
          to="/performance"
          icon={<BarChart3 className="w-5 h-5" />}
          label="Performance"
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          index={7}
          isMobile={isMobile}
        />
      </nav>

      {/* Sign Out Button - Conditionally rendered based on mobile state */}
      <div
        className={`${isMobile ? 'px-4 pb-4 transition-all duration-300 overflow-hidden cursor-pointer' : 'pt-4 mt-4'} ${isMobile && !isMobileMenuOpen ? 'max-h-0 opacity-0' : isMobile ? 'max-h-[50px] opacity-100' : 'block'}`}
        style={isMobile ? { transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' } : {}}
        onClick={isMobile ? (e) => e.stopPropagation() : undefined}
      >
        <NavItem
          icon={<LogOut className="w-5 h-5" />}
          label="Sign Out"
          onClick={handleSignOut}
          onMenuClick={highlightMenuItem}
          onNavClick={contractMenu}
          className="text-gray-400 hover:text-gray-200"
          index={8}
          isMobile={isMobile}
        />
      </div>

      {/* Bottom button removed as requested */}
    </div>
  );
};
