import React from 'react';
import { Eye, Monitor, Keyboard, MessageSquare } from 'lucide-react';

export function Accessibility() {
  return (
    <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
      <div className="flex items-center gap-3 mb-6">
        <Eye className="w-8 h-8 text-neon-turquoise" />
        <h2 className="text-2xl font-bold gradient-text">Accessibility</h2>
      </div>

      <div className="space-y-6">
        <p className="text-gray-300">
          We are committed to making our platform accessible to everyone. Our accessibility features are designed to ensure that all users can effectively use our trading platform.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-6 h-6 text-neon-yellow" />
              <h3 className="text-lg font-semibold text-neon-yellow">Visual Accessibility</h3>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li>• High contrast color schemes</li>
              <li>• Adjustable font sizes</li>
              <li>• Screen reader compatibility</li>
              <li>• Clear visual hierarchy</li>
              <li>• Alternative text for images</li>
            </ul>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Keyboard className="w-6 h-6 text-neon-orange" />
              <h3 className="text-lg font-semibold text-neon-orange">Navigation</h3>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li>• Keyboard navigation support</li>
              <li>• Skip navigation links</li>
              <li>• Consistent layout</li>
              <li>• Clear focus indicators</li>
              <li>• Logical tab order</li>
            </ul>
          </div>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-6 h-6 text-neon-pink" />
            <h3 className="text-lg font-semibold text-neon-pink">Support & Feedback</h3>
          </div>
          <p className="text-gray-300 mb-4">
            We're constantly working to improve our platform's accessibility. If you encounter any accessibility issues or have suggestions for improvement, please contact our support team.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-400">Email Support</p>
              <p className="text-neon-turquoise">accessibility@gigantic.ai</p>
            </div>
            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-400">Phone Support</p>
              <p className="text-neon-turquoise">+1 (800) 555-0123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}