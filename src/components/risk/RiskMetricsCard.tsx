interface RiskMetricsCardProps {
  metrics: {
    totalExposure: number;
    portfolioVar: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export function RiskMetricsCard({ metrics }: RiskMetricsCardProps) {
  return (
    <div className="bg-gunmetal-900/50 rounded-xl p-6">
      <h3 className="text-xl font-bold gradient-text mb-6">Risk Metrics</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gunmetal-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Total Exposure</p>
          <p className="text-2xl font-bold text-white">
            {metrics.totalExposure.toFixed(2)}%
          </p>
        </div>

        <div className="bg-gunmetal-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Portfolio VaR</p>
          <p className="text-2xl font-bold text-white">
            {metrics.portfolioVar.toFixed(2)}%
          </p>
        </div>

        <div className="bg-gunmetal-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Sharpe Ratio</p>
          <p className={`text-2xl font-bold ${
            metrics.sharpeRatio >= 1 ? 'text-green-400' : 'text-red-400'
          }`}>
            {metrics.sharpeRatio.toFixed(2)}
          </p>
        </div>

        <div className="bg-gunmetal-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Max Drawdown</p>
          <p className={`text-2xl font-bold ${
            metrics.maxDrawdown <= -20 ? 'text-red-400' : 'text-white'
          }`}>
            {metrics.maxDrawdown.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}