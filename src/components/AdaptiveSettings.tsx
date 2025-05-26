import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  User, 
  GraduationCap, 
  Brain, 
  Monitor, 
  Smartphone, 
  Bell, 
  Shield, 
  Palette,
  Save,
  RefreshCw
} from 'lucide-react';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { useResponsive } from '../lib/responsive-utils';
import { ExperienceModeSwitcher } from './ExperienceModeSwitcher';

export function AdaptiveSettings() {
  const { mode, preferences, updatePreferences, changeMode } = useExperienceMode();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [activeTab, setActiveTab] = useState<'experience' | 'display' | 'notifications' | 'security'>('experience');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Handle save preferences
  const handleSavePreferences = async (newPreferences: any) => {
    try {
      setIsSaving(true);
      const success = await updatePreferences(newPreferences);
      
      if (success) {
        setSaveMessage('Settings saved successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Failed to save settings');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      setSaveMessage('Error saving settings');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'experience', label: 'Experience Mode', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'display', label: 'Display', icon: <Monitor className="w-5 h-5" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6 text-neon-turquoise" />
          <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-3 rounded-lg ${
              saveMessage.includes('success') 
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {saveMessage}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="panel-metallic rounded-xl p-4">
              <nav className="space-y-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-neon-turquoise/20 text-neon-turquoise'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gunmetal-800'
                    }`}
                  >
                    {tab.icon}
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="panel-metallic rounded-xl p-6">
              {activeTab === 'experience' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-2">Experience Mode</h2>
                    <p className="text-gray-400 mb-6">
                      Choose your experience level to customize the interface and available features.
                    </p>
                  </div>

                  {/* Current Mode Display */}
                  <div className="bg-gunmetal-900/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium mb-1">Current Mode</h3>
                        <p className="text-sm text-gray-400">
                          You are currently using {mode} mode
                        </p>
                      </div>
                      <ExperienceModeSwitcher />
                    </div>
                  </div>

                  {/* Mode Comparison */}
                  <div>
                    <h3 className="font-medium mb-4">Mode Comparison</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${
                        mode === 'beginner' ? 'border-neon-green bg-neon-green/10' : 'border-gunmetal-700 bg-gunmetal-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <GraduationCap className="w-5 h-5 text-neon-green" />
                          <h4 className="font-medium">Beginner</h4>
                        </div>
                        <ul className="text-sm text-gray-400 space-y-1">
                          <li>• Simplified interface</li>
                          <li>• Educational content</li>
                          <li>• Guided workflows</li>
                          <li>• Pre-configured templates</li>
                        </ul>
                      </div>

                      <div className={`p-4 rounded-lg border ${
                        mode === 'intermediate' ? 'border-neon-turquoise bg-neon-turquoise/10' : 'border-gunmetal-700 bg-gunmetal-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-5 h-5 text-neon-turquoise" />
                          <h4 className="font-medium">Intermediate</h4>
                        </div>
                        <ul className="text-sm text-gray-400 space-y-1">
                          <li>• Standard interface</li>
                          <li>• Moderate customization</li>
                          <li>• Performance metrics</li>
                          <li>• Risk management tools</li>
                        </ul>
                      </div>

                      <div className={`p-4 rounded-lg border ${
                        mode === 'expert' ? 'border-neon-raspberry bg-neon-raspberry/10' : 'border-gunmetal-700 bg-gunmetal-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-5 h-5 text-neon-raspberry" />
                          <h4 className="font-medium">Expert</h4>
                        </div>
                        <ul className="text-sm text-gray-400 space-y-1">
                          <li>• Advanced interface</li>
                          <li>• Full customization</li>
                          <li>• Technical indicators</li>
                          <li>• API integration</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Mode-specific Preferences */}
                  <div>
                    <h3 className="font-medium mb-4">Preferences for {mode} mode</h3>
                    <div className="space-y-4">
                      {mode === 'beginner' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Show Tooltips</h4>
                              <p className="text-sm text-gray-400">Display helpful tooltips throughout the interface</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={(preferences as any)?.showTooltips || false}
                              onChange={(e) => handleSavePreferences({ showTooltips: e.target.checked })}
                              className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Show Guided Help</h4>
                              <p className="text-sm text-gray-400">Display step-by-step guidance for complex tasks</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={(preferences as any)?.showGuidedHelp || false}
                              onChange={(e) => handleSavePreferences({ showGuidedHelp: e.target.checked })}
                              className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise"
                            />
                          </div>
                        </>
                      )}

                      {mode === 'intermediate' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Dashboard Layout</h4>
                              <p className="text-sm text-gray-400">Choose your preferred dashboard layout</p>
                            </div>
                            <select
                              value={(preferences as any)?.dashboardLayout || 'standard'}
                              onChange={(e) => handleSavePreferences({ dashboardLayout: e.target.value })}
                              className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-1 text-sm"
                            >
                              <option value="standard">Standard</option>
                              <option value="compact">Compact</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Show Advanced Metrics</h4>
                              <p className="text-sm text-gray-400">Display advanced performance metrics</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={(preferences as any)?.showAdvancedMetrics || false}
                              onChange={(e) => handleSavePreferences({ showAdvancedMetrics: e.target.checked })}
                              className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise"
                            />
                          </div>
                        </>
                      )}

                      {mode === 'expert' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Dashboard Layout</h4>
                              <p className="text-sm text-gray-400">Choose your preferred dashboard layout</p>
                            </div>
                            <select
                              value={(preferences as any)?.dashboardLayout || 'advanced'}
                              onChange={(e) => handleSavePreferences({ dashboardLayout: e.target.value })}
                              className="bg-gunmetal-800 border border-gunmetal-700 rounded-lg px-3 py-1 text-sm"
                            >
                              <option value="standard">Standard</option>
                              <option value="advanced">Advanced</option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Show API Options</h4>
                              <p className="text-sm text-gray-400">Display API integration options</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={(preferences as any)?.showAPIOptions || false}
                              onChange={(e) => handleSavePreferences({ showAPIOptions: e.target.checked })}
                              className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Enable Experimental Features</h4>
                              <p className="text-sm text-gray-400">Access beta features and experimental tools</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={(preferences as any)?.enableExperimentalFeatures || false}
                              onChange={(e) => handleSavePreferences({ enableExperimentalFeatures: e.target.checked })}
                              className="w-4 h-4 rounded border-gunmetal-600 text-neon-turquoise focus:ring-neon-turquoise"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'display' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-2">Display Settings</h2>
                    <p className="text-gray-400 mb-6">
                      Customize the appearance and layout of the interface.
                    </p>
                  </div>

                  {/* Device Information */}
                  <div className="bg-gunmetal-900/50 rounded-lg p-4">
                    <h3 className="font-medium mb-2">Current Device</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      {isMobile && <Smartphone className="w-4 h-4" />}
                      {isTablet && <Monitor className="w-4 h-4" />}
                      {isDesktop && <Monitor className="w-4 h-4" />}
                      <span>
                        {isMobile ? 'Mobile Device' : isTablet ? 'Tablet' : 'Desktop'}
                      </span>
                    </div>
                  </div>

                  <div className="text-center py-8">
                    <p className="text-gray-500">Additional display settings coming soon...</p>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-2">Notification Settings</h2>
                    <p className="text-gray-400 mb-6">
                      Configure how and when you receive notifications.
                    </p>
                  </div>

                  <div className="text-center py-8">
                    <p className="text-gray-500">Notification settings coming soon...</p>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-2">Security Settings</h2>
                    <p className="text-gray-400 mb-6">
                      Manage your account security and privacy settings.
                    </p>
                  </div>

                  <div className="text-center py-8">
                    <p className="text-gray-500">Security settings coming soon...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
