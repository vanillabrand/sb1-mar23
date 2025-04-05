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
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle,
  Shield,
  XCircle,
  Loader2,
  Circle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/log-service';
import { websocketService } from '../lib/websocket-service';

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

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick, className, onMenuClick, index, isMobile, onNavClick }) => {
  const navRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const baseClass = `nav-item flex items-center transition-all duration-200 ${isMobile ? 'py-3 border-b border-gray-800' : ''} ${className || ''}`;

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

          if (isActive) {
            if (label === 'Dashboard') {
              activeStyles = 'bg-[#3a1a29] text-[#ff3e8e]';
            } else if (label === 'Strategy Manager') {
              activeStyles = 'bg-[#3a2e14] text-[#ffc700]';
            } else if (label === 'Backtest') {
              activeStyles = 'bg-[#3a2214] text-[#ff8c39]';
            } else if (label === 'Trade Monitor') {
              activeStyles = 'bg-[#1a3a3c] text-[#00f7ff]';
            } else if (label === 'Risk Manager') {
              activeStyles = 'bg-[#3a1a29] text-[#ff3e8e]';
            } else if (label === 'Exchange Manager') {
              activeStyles = 'bg-[#1a3a3c] text-[#00f7ff]';
            } else if (label === 'Bug Tracker') {
              activeStyles = 'bg-[#1a1a1a] text-gray-200';
            }
          }

          return `${baseClass} ${isActive
            ? `${activeStyles} font-medium`
            : 'text-gray-400 hover:text-gray-200'}`
        }}
        style={{
          animationDelay: `${index * 50}ms`,
          animationDuration: '500ms',
          borderRadius: '8px',
          padding: '12px 16px',
        }}
      >
        {icon}
        <span className="ml-3">{label}</span>
      </NavLink>
    );
  }

  return (
    <button
      ref={navRef as React.RefObject<HTMLButtonElement>}
      onClick={handleClick}
      className={`${baseClass} text-gray-400 hover:text-gray-200`}
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

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isExchangeDetailsExpanded, setIsExchangeDetailsExpanded] = useState(false);
  const [rainbowElements, setRainbowElements] = useState<HTMLElement[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Connection steps state
  const [connectionSteps, setConnectionSteps] = useState([
    { id: 'exchange', name: 'Exchange Connection', status: 'pending', message: '' },
    { id: 'websocket', name: 'WebSocket Connection', status: 'pending', message: '' },
    { id: 'market', name: 'Market Data', status: 'pending', message: '' }
  ]);
  const [latency, setLatency] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Function to create rainbow effect
  const createRainbowEffect = (element: HTMLElement) => {
    // Clear any existing rainbow elements
    rainbowElements.forEach(el => {
      el.classList.remove('rainbow-pulse');
    });
    setRainbowElements([]);

    // Apply rainbow effect to the clicked element
    element.classList.add('rainbow-pulse');
    const newRainbowElements: HTMLElement[] = [element];
    setRainbowElements(newRainbowElements);
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
        step.id === 'exchange' ? { ...step, status: 'completed', message: 'Exchange connected successfully' } : step
      ));

      // Step 2: Check WebSocket Connection
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'in_progress', message: 'Establishing WebSocket connection...' } : step
      ));

      // Simulate websocket connection (success for demo)
      await new Promise(resolve => setTimeout(resolve, 500));

      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'completed', message: 'WebSocket connected successfully' } : step
      ));

      // Step 3: Check Market Data
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'market' ? { ...step, status: 'in_progress', message: 'Loading market data...' } : step
      ));

      // Simulate market data loading (success for demo)
      await new Promise(resolve => setTimeout(resolve, 500));

      setConnectionSteps(prev => prev.map(step =>
        step.id === 'market' ? { ...step, status: 'completed', message: 'Market data loaded successfully' } : step
      ));

      // All steps completed successfully
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

  // Check connection status
  useEffect(() => {
    // Check connection status initially and every 30 seconds
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 30000);

    // Subscribe to websocket connection events
    const wsConnectedHandler = () => {
      setConnectionSteps(prev => prev.map(step =>
        step.id === 'websocket' ? { ...step, status: 'completed', message: 'WebSocket connected successfully' } : step
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

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  // Contract menu when nav item is clicked
  const contractMenu = () => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className={`${isMobile ? 'w-full h-auto shadow-md z-50' : 'w-64 h-screen'} bg-black flex ${isMobile ? 'flex-col' : 'flex-col'}`}>
      {/* Logo and Header - Always visible and fully interactive */}
      <div
        className={`${isMobile ? 'w-full px-4 py-2' : 'px-2 py-3 mb-6'} flex items-center ${isMobile ? 'justify-between' : ''} ${isMobile ? 'cursor-pointer' : ''}`}
        onClick={isMobile ? toggleMobileMenu : undefined}
      >
        <div className="flex items-center">
          <div className="rounded-xl bg-gradient-to-br from-green-400 via-yellow-400 to-pink-500 p-0.5">
            <div className="bg-black rounded-xl p-2">
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <div className="ml-3">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-400 text-transparent bg-clip-text">GIGAntic</div>
            <div className="text-gray-400 text-sm">AI Trading Platform</div>
          </div>
        </div>

        {/* Mobile Menu Toggle Button */}
        {isMobile && (
          <button
            onClick={toggleMobileMenu}
            className="text-gray-400 hover:text-gray-200 focus:outline-none"
          >
            {isMobileMenuOpen ? (
              <ChevronUp className="w-6 h-6" />
            ) : (
              <ChevronDown className="w-6 h-6" />
            )}
          </button>
        )}
      </div>

      {/* Connection Status Indicator - Conditionally rendered based on mobile state */}
      <div
        className={`${isMobile ? (isMobileMenuOpen ? 'block' : 'hidden') : 'block'} mb-6 relative z-10 px-4 ${isMobile ? 'cursor-pointer' : ''}`}
        onClick={isMobile ? toggleMobileMenu : undefined}
      >
        <div
          className={`flex items-center justify-between px-4 py-2 cursor-pointer ${isExchangeDetailsExpanded ? 'rounded-t-lg' : 'rounded-lg'} ${isConnected ? 'bg-[#0d2429] border border-[#00f7ff]/30' : 'bg-[#3a2434] border border-[#f1416c]/30'}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExchangeDetailsExpanded(prev => !prev);
          }}
        >
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-[#00f7ff]" />
            ) : (
              <WifiOff className="w-4 h-4 text-[#f1416c]" />
            )}
            <span className={`text-sm font-medium ${isConnected ? 'text-[#00f7ff]' : 'text-[#f1416c]'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {latency !== null && isConnected && (
              <span className="text-xs text-[#00f7ff]/70">{latency}ms</span>
            )}
          </div>
          {isExchangeDetailsExpanded ? (
            <ChevronUp className={`w-4 h-4 ${isConnected ? 'text-[#00f7ff]' : 'text-[#f1416c]'}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 ${isConnected ? 'text-[#00f7ff]' : 'text-[#f1416c]'}`} />
          )}
        </div>

        {/* Expanded Connection Details - Using simple transition */}
        <div
          className={`absolute left-0 right-0 mt-0 px-4 py-0 ${isConnected ? 'bg-[#0d2429]' : 'bg-[#3a2434]'} rounded-b-lg text-xs space-y-2.5 z-20 border-t-0 border-x border-b ${isConnected ? 'border-[#00f7ff]/30' : 'border-[#f1416c]/30'} transition-all duration-300 overflow-hidden ${isExchangeDetailsExpanded ? 'opacity-100 max-h-[500px] py-3' : 'opacity-0 max-h-0 border-opacity-0 pointer-events-none'}`}
          style={{ width: '100%', marginTop: '-1px', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        >
            {connectionSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-start">
                  <div className={`mt-1 mr-2 rounded-full p-0.5 ${step.status === 'completed' ? 'bg-[#00f7ff]/20' : step.status === 'error' ? 'bg-[#f1416c]/20' : 'bg-gray-800'}`}>
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-3 h-3 text-[#00f7ff]" />
                    ) : step.status === 'error' ? (
                      <XCircle className="w-3 h-3 text-[#f1416c]" />
                    ) : step.status === 'in_progress' ? (
                      <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                    ) : (
                      <Circle className="w-3 h-3 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className={`text-xs font-medium ${step.status === 'completed' ? 'text-[#00f7ff]' : step.status === 'error' ? 'text-[#f1416c]' : step.status === 'in_progress' ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {step.name}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {step.status === 'error' ? step.message || 'Connection failed' :
                       step.status === 'completed' ? step.message || `${step.name.split(' ')[0]} connected successfully` :
                       step.status === 'in_progress' ? 'Connecting...' : 'Waiting...'}
                    </div>
                  </div>
                </div>
                {index < connectionSteps.length - 1 && (
                  <div className={`border-l ml-1.5 pl-5 -mt-1 pt-1 ${step.status === 'completed' ? 'border-[#00f7ff]/20' : step.status === 'error' ? 'border-[#f1416c]/20' : 'border-gray-800'}`}></div>
                )}
              </React.Fragment>
            ))}

            {/* Retry button if there's an error */}
            {connectionSteps.some(step => step.status === 'error') && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    retryConnection();
                  }}
                  disabled={isRetrying}
                  className={`px-2 py-1 rounded text-[10px] font-medium ${isRetrying ? 'bg-gray-800 text-gray-400' : 'bg-[#f1416c]/20 text-[#f1416c] hover:bg-[#f1416c]/30'}`}
                >
                  {isRetrying ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
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
        className={`flex flex-1 ${isMobile ? 'px-4 pb-4' : ''} ${isMobile ? 'flex-col transition-all duration-300 overflow-hidden cursor-pointer' : 'flex-col space-y-2'} ${isMobile && !isMobileMenuOpen ? 'max-h-0 opacity-0' : isMobile ? 'max-h-[1000px] opacity-100' : ''}`}
        style={isMobile ? { transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' } : {}}
        onClick={isMobile ? (e) => e.stopPropagation() : undefined}
      >
        <NavItem
          to="/dashboard"
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Dashboard"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={0}
          isMobile={isMobile}
        />
        <NavItem
          to="/strategy-manager"
          icon={<Brain className="w-5 h-5" />}
          label="Strategy Manager"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={1}
          isMobile={isMobile}
        />
        <NavItem
          to="/backtest"
          icon={<History className="w-5 h-5" />}
          label="Backtest"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={2}
          isMobile={isMobile}
        />
        <NavItem
          to="/trade-monitor"
          icon={<Monitor className="w-5 h-5" />}
          label="Trade Monitor"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={3}
          isMobile={isMobile}
        />
        <NavItem
          to="/risk-manager"
          icon={<Shield className="w-5 h-5" />}
          label="Risk Manager"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={4}
          isMobile={isMobile}
        />
        <NavItem
          to="/exchange-manager"
          icon={<Building2 className="w-5 h-5" />}
          label="Exchange Manager"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={5}
          isMobile={isMobile}
        />
        <NavItem
          to="/bug-tracker"
          icon={<Bug className="w-5 h-5" />}
          label="Bug Tracker"
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          index={6}
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
          onMenuClick={createRainbowEffect}
          onNavClick={contractMenu}
          className="text-gray-400 hover:text-gray-200"
          index={7}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
};
