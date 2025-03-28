interface PositionRiskRowProps {
  position: {
    id: string;
    symbol: string;
    size: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    drawdown: number;
    valueAtRisk: number;
  };
  onAlert: () => void;
}

export function PositionRiskRow({ position, onAlert }: PositionRiskRowProps) {
  const getRiskLevelColor = () => {
    switch (position.riskLevel) {
      case 'low':
        return 'text-green-400';
      case 'medium':
        return 'text-neon-amber';
      case 'high':
        return 'text-orange-400';
      case 'critical':
        return 'text-neon-raspberry';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <tr className="text-gray-300">
      <td className="px-4 py-3">{position.symbol}</td>
      <td className="px-4 py-3">{position.size.toFixed(4)}</td>
      <td className={`px-4 py-3 ${getRiskLevelColor()} capitalize`}>
        {position.riskLevel}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gunmetal-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                position.drawdown > 15 ? 'bg-neon-raspberry' : 'bg-neon-turquoise'
              }`}
              style={{ width: `${Math.min(position.drawdown, 100)}%` }}
            />
          </div>
          <span>{position.drawdown.toFixed(2)}%</span>
        </div>
      </td>
      <td className="px-4 py-3">{position.valueAtRisk.toFixed(2)}%</td>
      <td className="px-4 py-3">
        <button
          onClick={onAlert}
          className="p-1 text-gray-400 hover:text-neon-turquoise transition-colors"
        >
          <Bell className="w-5 h-5" />
        </button>
      </td>
    </tr>
  );
}