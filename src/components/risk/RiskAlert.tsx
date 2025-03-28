interface RiskAlertProps {
  alert: {
    id: string;
    type: 'position' | 'portfolio' | 'market';
    severity: 'warning' | 'critical';
    message: string;
    timestamp: Date;
    actions?: string[];
  };
  onDismiss: () => void;
  onAction: (action: string) => void;
}

export function RiskAlert({ alert, onDismiss, onAction }: RiskAlertProps) {
  const getSeverityStyles = () => {
    return alert.severity === 'critical'
      ? 'border-l-neon-raspberry text-neon-raspberry'
      : 'border-l-neon-amber text-neon-amber';
  };

  return (
    <div className={`
      bg-gunmetal-900/50 
      border-l-4 
      ${getSeverityStyles()}
      rounded-r-xl 
      p-4
      flex 
      items-center 
      justify-between
    `}>
      <div className="flex items-center gap-3">
        {alert.severity === 'critical' ? (
          <AlertOctagon className="w-5 h-5" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
        <div>
          <p className="font-medium">{alert.message}</p>
          <p className="text-sm text-gray-400">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {alert.actions?.map((action) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className="px-3 py-1 text-sm rounded-lg bg-gunmetal-800 hover:bg-gunmetal-700 transition-colors"
          >
            {action}
          </button>
        ))}
        <button
          onClick={onDismiss}
          className="p-1 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}