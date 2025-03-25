import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity,
  AlertCircle,
  Brain,
  Bug,
  Clock,
  Coins,
  DollarSign,
  Loader2,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  Target,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Globe,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { Auth } from './components/Auth';
import Dashboard from './components/Dashboard';
import StrategyManager from './components/StrategyManager';
import Backtester from './components/Backtester';
import TradeMonitor from './components/TradeMonitor';
import RiskManager from './components/RiskManager';
import ExchangeManager from './components/ExchangeManager';
import BugTracker from './components/BugTracker';
import { Settings } from './components/Settings';
import { Footer } from './components/Footer';
import { ContactForm } from './components/ContactForm';
import { TermsAndConditions } from './components/TermsAndConditions';
import { LogWindow } from './components/LogWindow';
import { AuthProvider, useAuth } from './lib/auth-context';
import { KilnLogo } from './components/KilnLogo';
import { exchangeService } from './lib/exchange-service';
import { logService } from './lib/log-service';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Link, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { CookiePolicy } from './components/CookiePolicy';
import { ResponsibleTrading } from './components/ResponsibleTrading';
import { Accessibility } from './components/Accessibility';
import { CommunityGuidelines } from './components/CommunityGuidelines';
import { HowItWorks } from './components/HowItWorks';
import { Hero } from './components/Hero';
import { Preloader } from './components/Preloader';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showLogWindow, setShowLogWindow] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [connectionClosed, setConnectionClosed] = useState(false);
  const [selectedPath, setSelectedPath] = useState('/');
  const [triggerShimmer, setTriggerShimmer] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();

  useEffect(() => {
    loadMarketBalance();
  }, []);

  useEffect(() => {
    if (location.pathname !== selectedPath) {
      setSelectedPath(location.pathname);
      setTriggerShimmer(prev => prev + 1);
      setShowMobileMenu(false);
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const loadMarketBalance = async () => {
    try {
      setIsInitializing(true);
      setInitError(null);
      
      const credentials = exchangeService.getCredentials();
      
      if (credentials) {
        logService.log('info', 'Found stored exchange credentials, initializing connection...', null, 'App');
        
        await exchangeService.initializeExchange({
          name: 'bitmart',
          apiKey: credentials.apiKey,
          secret: credentials.secret,
          memo: credentials.memo || '',
          testnet: false
        });
        
        logService.log('info', 'Successfully connected to exchange', null, 'App');
      } else {
        logService.log('info', 'No stored credentials found, initializing in demo mode', null, 'App');
        
        await exchangeService.initializeExchange({
          name: 'bitmart',
          apiKey: 'demo',
          secret: 'demo',
          memo: 'demo',
          testnet: true
        });
      }
    } catch (error) {
      logService.log('error', 'Failed to load market balance', error, 'App');
      setInitError('Failed to connect to exchange. Running in demo mode.');
      
      await exchangeService.initializeExchange({
        name: 'bitmart',
        apiKey: 'demo',
        secret: 'demo',
        memo: 'demo',
        testnet: true
      });
    } finally {
      setTimeout(() => {
        setIsInitializing(false);
      }, 1500);
    }
  };

  const handleConnectionPanelClose = () => {
    setConnectionClosed(true);
  };

  const menuItems = [
    { path: '/', icon: Activity, name: 'Dashboard', color: 'neon-raspberry' },
    { path: '/strategy', icon: Brain, name: 'Strategy Manager', color: 'neon-yellow' },
    { path: '/backtest', icon: Clock, name: 'Backtester', color: 'neon-orange' },
    { path: '/monitor', icon: Target, name: 'Trade Monitor', color: 'neon-turquoise' },
    { path: '/risk', icon: Shield, name: 'Risk Manager', color: 'neon-pink' },
    { path: '/wallet', icon: Coins, name: 'Exchange Manager', color: 'neon-turquoise' },
    { path: '/bugs', icon: Bug, name: 'Bug Tracker', color: 'neon-raspberry' }
  ];

  const menuItemVariants = {
    initial: { 
      backgroundColor: 'rgba(31, 31, 35, 0)',
      transition: { duration: 0 }
    },
    shimmer: (i: number) => ({
      backgroundColor: [
        'rgba(31, 31, 35, 0)',
        'rgba(45, 212, 191, 0.1)',
        'rgba(250, 204, 21, 0.1)',
        'rgba(251, 146, 60, 0.1)',
        'rgba(236, 72, 153, 0.1)',
        'rgba(31, 31, 35, 0)'
      ],
      transition: {
        delay: i * 0.1,
        duration: 1,
        ease: [0.455, 0.03, 0.515, 0.955],
        times: [0, 0.2, 0.4, 0.6, 0.8, 1]
      }
    })
  };

  if (loading || isInitializing) {
    return <Preloader />;
  }

  if (!user) {
    return <Hero />;
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gunmetal-950">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-neon-pink mx-auto" />
          <p className="text-neon-pink">{initError}</p>
          <button
            onClick={() => setIsInitializing(false)}
            className="mt-4 px-4 py-2 bg-neon-yellow text-gunmetal-950 rounded-lg hover:bg-neon-orange transition-all"
          >
            Continue in Demo Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gunmetal-950">
      {/* Mobile Navigation */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30">
        <div className="bg-gradient-to-br from-gunmetal-800 to-gunmetal-900 border-x border-b border-gunmetal-700/50 rounded-b-xl shadow-lg backdrop-blur-xl">
          {/* Top Bar with Logo and Menu Toggle */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gunmetal-700/50">
            <KilnLogo className="scale-75" />
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ChevronDown
                className={`w-6 h-6 transition-transform duration-300 ${
                  showMobileMenu ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Slide Down Menu */}
          <AnimatePresence>
            {showMobileMenu && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-4 gap-2 p-4">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all duration-200 ${
                          isActive 
                            ? `bg-${item.color}/20 text-${item.color}` 
                            : 'text-gray-400 hover:bg-gunmetal-800/30'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                  <button
                    onClick={() => setShowLogWindow(true)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-400 hover:bg-gunmetal-800/30 transition-all duration-200"
                  >
                    <Bug className="w-6 h-6" />
                    <span className="text-xs font-medium">Debug</span>
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-400 hover:bg-gunmetal-800/30 transition-all duration-200"
                  >
                    <SettingsIcon className="w-6 h-6" />
                    <span className="text-xs font-medium">Settings</span>
                  </button>
                  <button
                    onClick={signOut}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-400 hover:bg-neon-pink/20 hover:text-neon-pink transition-all duration-200"
                  >
                    <LogOut className="w-6 h-6" />
                    <span className="text-xs font-medium">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30 w-64 bg-gunmetal-900/30 backdrop-blur-xl">
        <div className="flex items-center justify-between p-6">
          <KilnLogo />
        </div>

        {/* Connection Status */}
        <div className="px-4 mb-4">
          <ConnectionStatus onClose={handleConnectionPanelClose} />
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <motion.div
                key={item.path}
                variants={menuItemVariants}
                initial="initial"
                animate={triggerShimmer ? "shimmer" : "initial"}
                custom={index}
              >
                <Link
                  to={item.path}
                  onClick={() => {
                    setTriggerShimmer(prev => prev + 1);
                    window.scrollTo(0, 0);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    isActive 
                      ? `bg-${item.color}/20 text-${item.color}` 
                      : 'text-gray-400 hover:bg-gunmetal-800/30'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Settings Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          <button 
            onClick={() => setShowLogWindow(!showLogWindow)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-400 hover:bg-gunmetal-800/30 transition-all duration-200 mb-2"
          >
            <Bug className="w-5 h-5 text-neon-yellow" />
            Debug Logs
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-400 hover:bg-gunmetal-800/30 transition-all duration-200"
          >
            <SettingsIcon className="w-5 h-5 text-neon-turquoise" />
            Settings
          </button>
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-400 hover:bg-neon-pink/20 hover:text-neon-pink transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="lg:ml-64 min-h-screen pb-24 pt-20 lg:pt-0"
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/strategy" element={<StrategyManager />} />
          <Route path="/backtest" element={<Backtester />} />
          <Route path="/monitor" element={<TradeMonitor />} />
          <Route path="/risk" element={<RiskManager />} />
          <Route path="/wallet" element={<ExchangeManager />} />
          <Route path="/bugs" element={<BugTracker />} />
          <Route path="/contact" element={<ContactForm />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/responsible-trading" element={<ResponsibleTrading />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/community" element={<CommunityGuidelines />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>

      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* Debug Log Window */}
      {showLogWindow && <LogWindow onClose={() => setShowLogWindow(false)} />}

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}