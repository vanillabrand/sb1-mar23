import React from 'react';
import { AlertTriangle, Shield, Scale } from 'lucide-react';

export function TermsAndConditions() {
  return (
    <div className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800">
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-8 h-8 text-neon-yellow" />
        <h2 className="text-2xl font-bold gradient-text">Terms & Conditions</h2>
      </div>

      <div className="space-y-6">
        {/* Risk Warning */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-red-400 mb-2">Important Risk Warning</h3>
              <p className="text-gray-300">
                StratGen is not regulated by the Financial Conduct Authority (FCA) or any other regulatory body. 
                Cryptocurrency trading involves substantial risk and is not suitable for all investors. 
                The high degree of leverage can work against you as well as for you.
              </p>
            </div>
          </div>
        </div>

        {/* Risk Disclosure */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Risk Disclosure</h3>
          <p className="text-gray-300">
            Before deciding to participate in cryptocurrency trading, you should carefully consider 
            your investment objectives, level of experience, and risk appetite. The possibility 
            exists that you could sustain a loss of some or all of your initial investment.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Past performance is not indicative of future results</li>
            <li>Cryptocurrency trading is highly speculative and volatile</li>
            <li>Your capital is at risk and you may lose more than your initial investment</li>
            <li>AI-generated trading strategies do not guarantee profits</li>
            <li>Technical issues or market conditions may affect trading performance</li>
          </ul>
        </div>

        {/* Legal Disclaimer */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Legal Disclaimer</h3>
          <p className="text-gray-300">
            The information provided by StratGen does not constitute investment advice, financial 
            advice, trading advice, or any other sort of advice. You should not treat any of the 
            content as such. StratGen does not recommend that any cryptocurrency should be bought, 
            sold, or held by you.
          </p>
          <p className="text-gray-300">
            Do conduct your own due diligence and consult your financial advisor before making any 
            investment decisions. By using StratGen, you acknowledge and agree that you are solely 
            responsible for determining the nature, potential value, and suitability of any 
            particular trading strategy or transaction.
          </p>
        </div>

        {/* Regulatory Status */}
        <div className="bg-gunmetal-800/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-neon-orange flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-neon-orange mb-2">Regulatory Status</h3>
              <p className="text-gray-300">
                StratGen is not regulated by the Financial Conduct Authority (FCA) or any other 
                regulatory body. We do not provide regulated financial services or advice. All 
                trading activities are conducted through third-party exchanges that may or may not 
                be regulated in their respective jurisdictions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}