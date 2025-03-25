import React from 'react';
import { Shield, Lock, Eye, FileText } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-neon-turquoise" />
        <h2 className="text-2xl font-bold gradient-text">Privacy Policy</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-neon-yellow" />
            <h3 className="text-lg font-semibold text-neon-yellow">Data Collection</h3>
          </div>
          <p className="text-gray-300">
            We collect and process your data to provide you with the best possible trading experience. This includes:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-2 text-gray-300">
            <li>Account information (email, username)</li>
            <li>Trading preferences and strategy configurations</li>
            <li>Performance metrics and trading history</li>
            <li>Technical data for service optimization</li>
          </ul>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-neon-orange" />
            <h3 className="text-lg font-semibold text-neon-orange">Data Security</h3>
          </div>
          <p className="text-gray-300">
            Your security is our top priority. We implement industry-standard security measures:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-2 text-gray-300">
            <li>End-to-end encryption for all sensitive data</li>
            <li>Regular security audits and penetration testing</li>
            <li>Secure data storage with redundant backups</li>
            <li>Strict access controls and authentication</li>
          </ul>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-neon-pink" />
            <h3 className="text-lg font-semibold text-neon-pink">Your Rights</h3>
          </div>
          <p className="text-gray-300">
            You have the right to:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-2 text-gray-300">
            <li>Access your personal data</li>
            <li>Request data correction or deletion</li>
            <li>Object to data processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>
        </div>
      </div>
    </div>
  );
}