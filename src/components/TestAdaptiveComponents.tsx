import React from 'react';
import { motion } from 'framer-motion';
import { useExperienceMode } from '../hooks/useExperienceMode';
import { useResponsive } from '../lib/responsive-utils';
import {
  GraduationCap,
  User,
  Brain,
  Monitor,
  Smartphone,
  Tablet,
  Check,
  X
} from 'lucide-react';

export function TestAdaptiveComponents() {
  const { mode, preferences, isLoading } = useExperienceMode();
  const { screenSize, isMobile, isTablet, isDesktop } = useResponsive();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 bg-neon-turquoise/20"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8 pb-24 sm:pb-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-2xl font-bold gradient-text mb-6">Adaptive Components Test</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Experience Mode Status */}
          <div className="panel-metallic rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              {mode === 'beginner' && <GraduationCap className="w-6 h-6 text-neon-green" />}
              {mode === 'intermediate' && <User className="w-6 h-6 text-neon-turquoise" />}
              {mode === 'expert' && <Brain className="w-6 h-6 text-neon-raspberry" />}
              Experience Mode Status
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Current Mode:</span>
                <span className={`font-medium ${
                  mode === 'beginner' ? 'text-neon-green' :
                  mode === 'intermediate' ? 'text-neon-turquoise' :
                  'text-neon-raspberry'
                }`}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </span>
              </div>

              <div className="border-t border-gunmetal-700 pt-4">
                <h3 className="font-medium mb-2">Current Preferences:</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(preferences).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-gray-400">{key}:</span>
                      <span className="flex items-center gap-1">
                        {typeof value === 'boolean' ? (
                          value ? (
                            <Check className="w-4 h-4 text-neon-green" />
                          ) : (
                            <X className="w-4 h-4 text-gray-500" />
                          )
                        ) : (
                          <span>{String(value)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Responsive Status */}
          <div className="panel-metallic rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              {isMobile && <Smartphone className="w-6 h-6 text-neon-yellow" />}
              {isTablet && <Tablet className="w-6 h-6 text-neon-turquoise" />}
              {isDesktop && <Monitor className="w-6 h-6 text-neon-green" />}
              Responsive Status
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Screen Size:</span>
                <span className="font-medium text-neon-turquoise">{screenSize}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Device Type:</span>
                <span className="font-medium">
                  {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
                </span>
              </div>

              <div className="border-t border-gunmetal-700 pt-4">
                <h3 className="font-medium mb-2">Device Capabilities:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Touch Device:</span>
                    <span className="flex items-center gap-1">
                      {isMobile || isTablet ? (
                        <Check className="w-4 h-4 text-neon-green" />
                      ) : (
                        <X className="w-4 h-4 text-gray-500" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Large Screen:</span>
                    <span className="flex items-center gap-1">
                      {isDesktop ? (
                        <Check className="w-4 h-4 text-neon-green" />
                      ) : (
                        <X className="w-4 h-4 text-gray-500" />
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Component Status */}
          <div className="panel-metallic rounded-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Adaptive Components Status</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gunmetal-900/50 rounded-lg p-4">
                <h3 className="font-medium mb-2 text-neon-green">✓ Implemented</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Experience Mode Service</li>
                  <li>• Experience Mode Context</li>
                  <li>• Mode Switcher Component</li>
                  <li>• Onboarding Experience</li>
                  <li>• Adaptive Dashboard</li>
                  <li>• Adaptive Settings</li>
                  <li>• Responsive Utilities</li>
                </ul>
              </div>

              <div className="bg-gunmetal-900/50 rounded-lg p-4">
                <h3 className="font-medium mb-2 text-neon-yellow">⚠ Partial</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Adaptive Strategy Manager</li>
                  <li>• Adaptive Trade Monitor</li>
                  <li>• Beginner UI Components</li>
                  <li>• Expert UI Components</li>
                  <li>• Educational Content</li>
                </ul>
              </div>

              <div className="bg-gunmetal-900/50 rounded-lg p-4">
                <h3 className="font-medium mb-2 text-neon-raspberry">✗ Pending</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Advanced Analytics</li>
                  <li>• Code Editor Integration</li>
                  <li>• Batch Operations</li>
                  <li>• Import/Export Features</li>
                  <li>• Mobile Optimizations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Test Actions */}
        <div className="mt-6 panel-metallic rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Test Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-4 py-2 bg-neon-turquoise text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Test Adaptive Dashboard
            </button>
            <button
              onClick={() => window.location.href = '/strategy-manager'}
              className="px-4 py-2 bg-neon-green text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Test Strategy Manager
            </button>
            <button
              onClick={() => window.location.href = '/trade-monitor'}
              className="px-4 py-2 bg-neon-yellow text-gunmetal-950 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Test Trade Monitor
            </button>
            <button
              onClick={() => window.location.href = '/settings'}
              className="px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Test Settings
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
