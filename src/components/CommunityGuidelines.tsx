import React from 'react';
import { Users, MessageSquare, Shield, Heart } from 'lucide-react';

export function CommunityGuidelines() {
  return (
    <div className="panel-metallic backdrop-blur-xl rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-neon-turquoise" />
        <h2 className="text-2xl font-bold gradient-text">Community Guidelines</h2>
      </div>

      <div className="space-y-6">
        <p className="text-gray-300">
          Our community is built on trust, respect, and collaboration. These guidelines ensure a positive environment for all members.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-6 h-6 text-neon-yellow" />
              <h3 className="text-lg font-semibold text-neon-yellow">Communication Standards</h3>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li>• Be respectful and professional</li>
              <li>• No hate speech or harassment</li>
              <li>• Avoid spam and self-promotion</li>
              <li>• Keep discussions relevant</li>
              <li>• Use appropriate language</li>
            </ul>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-neon-orange" />
              <h3 className="text-lg font-semibold text-neon-orange">Trading Ethics</h3>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li>• No market manipulation</li>
              <li>• Share accurate information</li>
              <li>• Respect others' strategies</li>
              <li>• No unauthorized bots</li>
              <li>• Report suspicious activity</li>
            </ul>
          </div>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-neon-pink" />
            <h3 className="text-lg font-semibold text-neon-pink">Community Support</h3>
          </div>
          <p className="text-gray-300 mb-4">
            We encourage members to help each other while maintaining a positive and constructive environment. Share your knowledge and experiences, but remember:
          </p>
          <ul className="space-y-2 text-gray-300">
            <li>• Provide constructive feedback</li>
            <li>• Help newcomers learn</li>
            <li>• Share success stories responsibly</li>
            <li>• Respect privacy and confidentiality</li>
          </ul>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-neon-turquoise mb-4">Enforcement</h3>
          <p className="text-gray-300">
            Violations of these guidelines may result in warnings, temporary suspension, or permanent account closure. We maintain the right to moderate content and take appropriate action to maintain a healthy community environment.
          </p>
        </div>
      </div>
    </div>
  );
}