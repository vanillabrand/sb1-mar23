import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Moon,
  Sun,
  Globe,
  Lock,
  Shield,
  Wallet,
  X,
  Check,
  ChevronRight,
  Power
} from 'lucide-react';
import { exchangeService } from '../lib/exchange-service';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState('en');
  const [twoFactor, setTwoFactor] = useState(false);
  const [riskWarnings, setRiskWarnings] = useState(true);
  const [autoLockTimeout, setAutoLockTimeout] = useState(15);
  const [isLiveMode, setIsLiveMode] = useState(exchangeService.isLive());
  const [isToggling, setIsToggling] = useState(false);
  const hasCredentials = exchangeService.hasCredentials();

  const handleModeToggle = async () => {
    if (!hasCredentials && !isLiveMode) {
      alert('Please set up your wallet credentials first in the Wallet Manager.');
      return;
    }

    try {
      setIsToggling(true);
      await exchangeService.switchMode(!isLiveMode);
      setIsLiveMode(!isLiveMode);
    } catch (error) {
      console.error('Error toggling mode:', error);
      alert('Failed to switch mode. Please check your wallet credentials.');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gunmetal-800">
        <div className="flex items-center justify-between p-6 border-b border-gunmetal-800">
          <h2 className="text-2xl font-bold gradient-text">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Trading Mode */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Trading Mode</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Power className="w-5 h-5 text-neon-turquoise" />
                <div>
                  <p className="font-medium text-gray-200">Live Trading</p>
                  <p className="text-sm text-gray-400">Switch between demo and live trading</p>
                </div>
              </div>
              <button
                onClick={handleModeToggle}
                disabled={isToggling}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isLiveMode ? 'bg-neon-turquoise' : 'bg-gunmetal-700'
                } ${!hasCredentials && !isLiveMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-gunmetal-950 transition-transform ${
                    isLiveMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {!hasCredentials && (
              <p className="mt-2 text-sm text-neon-orange">
                Please set up your wallet credentials in the Wallet Manager to enable live trading.
              </p>
            )}
          </div>

          {/* Appearance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-neon-turquoise" />
                  ) : (
                    <Sun className="w-5 h-5 text-neon-yellow" />
                  )}
                  <div>
                    <p className="font-medium text-gray-200">Dark Mode</p>
                    <p className="text-sm text-gray-400">Switch between light and dark themes</p>
                  </div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    darkMode ? 'bg-neon-turquoise' : 'bg-gunmetal-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-gunmetal-950 transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-neon-turquoise" />
                  <div>
                    <p className="font-medium text-gray-200">Language</p>
                    <p className="text-sm text-gray-400">Choose your preferred language</p>
                  </div>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-neon-turquoise" />
                  <div>
                    <p className="font-medium text-gray-200">Push Notifications</p>
                    <p className="text-sm text-gray-400">Get notified about important updates</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications ? 'bg-neon-turquoise' : 'bg-gunmetal-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-gunmetal-950 transition-transform ${
                      notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Security */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Security</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-neon-turquoise" />
                  <div>
                    <p className="font-medium text-gray-200">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-400">Add an extra layer of security</p>
                  </div>
                </div>
                <button
                  onClick={() => setTwoFactor(!twoFactor)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    twoFactor ? 'bg-neon-turquoise' : 'bg-gunmetal-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-gunmetal-950 transition-transform ${
                      twoFactor ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-neon-turquoise" />
                  <div>
                    <p className="font-medium text-gray-200">Risk Warnings</p>
                    <p className="text-sm text-gray-400">Show warnings for high-risk actions</p>
                  </div>
                </div>
                <button
                  onClick={() => setRiskWarnings(!riskWarnings)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    riskWarnings ? 'bg-neon-turquoise' : 'bg-gunmetal-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-gunmetal-950 transition-transform ${
                      riskWarnings ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-neon-turquoise" />
                  <div>
                    <p className="font-medium text-gray-200">Auto-Lock Timeout</p>
                    <p className="text-sm text-gray-400">Lock wallet after inactivity</p>
                  </div>
                </div>
                <select
                  value={autoLockTimeout}
                  onChange={(e) => setAutoLockTimeout(parseInt(e.target.value))}
                  className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-turquoise focus:border-transparent"
                >
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gunmetal-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-neon-yellow transition-all duration-300 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}