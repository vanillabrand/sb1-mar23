interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: number;
  };
  severity?: 'normal' | 'warning' | 'critical';
}

export function MetricCard({ title, value, icon, trend, severity = 'normal' }: MetricCardProps) {
  const getSeverityColor = () => {
    switch (severity) {
      case 'warning':
        return 'text-neon-amber';
      case 'critical':
        return 'text-neon-raspberry';
      default:
        return 'text-neon-turquoise';
    }
  };

  const getTrendIcon = () => {
    switch (trend?.direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-gunmetal-900/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && <div className={`${getSeverityColor()}`}>{icon}</div>}
          <h3 className="text-gray-400 font-medium">{title}</h3>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            trend.direction === 'up' ? 'text-green-400' :
            trend.direction === 'down' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {getTrendIcon()}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold ${getSeverityColor()}`}>
        {value}
      </div>
    </div>
  );
}