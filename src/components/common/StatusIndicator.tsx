interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StatusIndicator({ status, size = 'md', showLabel = false }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-400';
      case 'warning':
        return 'bg-neon-amber';
      case 'error':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`
        ${getSizeClasses()}
        ${getStatusColor()}
        rounded-full
      `} />
      {showLabel && (
        <span className="text-sm text-gray-400 capitalize">
          {status}
        </span>
      )}
    </div>
  );
}