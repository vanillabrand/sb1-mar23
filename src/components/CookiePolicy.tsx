import React from 'react';
import { Cookie, Settings, Shield, Info } from 'lucide-react';

export function CookiePolicy() {
  return (
    <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
      <div className="flex items-center gap-3 mb-6">
        <Cookie className="w-8 h-8 text-neon-orange" />
        <h2 className="text-2xl font-bold gradient-text">Cookie Policy</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Info className="w-6 h-6 text-neon-turquoise" />
            <h3 className="text-lg font-semibold text-neon-turquoise">What Are Cookies?</h3>
          </div>
          <p className="text-gray-300">
            Cookies are small text files stored on your device that help us provide and improve our services. They are essential for certain features and help us understand how you use our platform.
          </p>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-neon-yellow" />
            <h3 className="text-lg font-semibold text-neon-yellow">Types of Cookies We Use</h3>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-neon-turquoise mb-2">Essential Cookies</h4>
              <p className="text-gray-300">Required for basic platform functionality and security.</p>
            </div>
            <div>
              <h4 className="font-medium text-neon-orange mb-2">Performance Cookies</h4>
              <p className="text-gray-300">Help us understand how users interact with our platform.</p>
            </div>
            <div>
              <h4 className="font-medium text-neon-pink mb-2">Functionality Cookies</h4>
              <p className="text-gray-300">Remember your preferences and settings.</p>
            </div>
          </div>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-neon-raspberry" />
            <h3 className="text-lg font-semibold text-neon-raspberry">Your Cookie Choices</h3>
          </div>
          <p className="text-gray-300 mb-4">
            You can control and/or delete cookies as you wish. You can delete all cookies that are already on your device and you can set most browsers to prevent them from being placed.
          </p>
          <div className="bg-gunmetal-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">
              Note: Disabling certain cookies may limit your ability to use some features of our platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}