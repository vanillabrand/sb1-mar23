interface TemplateCardProps {
  template: StrategyTemplate;
  onSelect: () => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <div 
      className="bg-gunmetal-800 rounded-xl p-6 hover:bg-gunmetal-700 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200">{template.title}</h3>
        <RiskBadge level={template.risk_level} />
      </div>
      
      <p className="text-gray-400 text-sm mb-4">{template.description}</p>
      
      <div className="grid grid-cols-2 gap-4">
        <MetricBox
          label="Win Rate"
          value={`${(template.metrics?.winRate || 0).toFixed(1)}%`}
        />
        <MetricBox
          label="Avg Return"
          value={`${(template.metrics?.avgReturn || 0).toFixed(1)}%`}
        />
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${colors[level] || colors.medium}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </span>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gunmetal-900 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-semibold text-gray-200">{value}</div>
    </div>
  );
}