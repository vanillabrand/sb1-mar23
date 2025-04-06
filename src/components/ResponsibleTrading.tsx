import React from 'react';
import { Shield, AlertTriangle, Brain, Target } from 'lucide-react';

export function ResponsibleTrading() {
  return (
    <div className="panel-metallic backdrop-blur-xl rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-neon-yellow" />
        <h2 className="text-2xl font-bold gradient-text">Responsible Trading</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-red-400 mb-2">Risk Warning</h3>
              <p className="text-gray-300">
                Cryptocurrency trading involves substantial risk and is not suitable for all investors.
                The high degree of leverage can work against you as well as for you. Before deciding
                to trade cryptocurrencies, you should carefully consider your investment objectives,
                level of experience, and risk appetite.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-6 h-6 text-neon-turquoise" />
              <h3 className="text-lg font-semibold text-neon-turquoise">Trading Best Practices</h3>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li>• Never trade with money you can't afford to lose</li>
              <li>• Always use stop-loss orders</li>
              <li>• Diversify your trading portfolio</li>
              <li>• Keep detailed trading records</li>
              <li>• Stay informed about market conditions</li>
            </ul>
          </div>

          <div className="bg-gunmetal-800/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-neon-orange" />
              <h3 className="text-lg font-semibold text-neon-orange">Risk Management</h3>
            </div>
            <ul className="space-y-2 text-gray-300">
              <li>• Set clear risk limits per trade</li>
              <li>• Use proper position sizing</li>
              <li>• Monitor your exposure levels</li>
              <li>• Implement risk-reward ratios</li>
              <li>• Regular portfolio rebalancing</li>
            </ul>
          </div>
        </div>

        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-neon-pink mb-4">Getting Help</h3>
          <p className="text-gray-300 mb-4">
            If you feel that your trading is becoming problematic or you're experiencing financial stress,
            don't hesitate to seek help. We provide resources and support to help you maintain healthy
            trading practices.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-400">24/7 Support</p>
              <p className="text-neon-turquoise">support@gigantic.ai</p>
            </div>
            <div className="bg-gunmetal-900/30 p-3 rounded-lg">
              <p className="text-sm text-gray-400">Emergency Hotline</p>
              <p className="text-neon-turquoise">+1 (800) 555-0123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}