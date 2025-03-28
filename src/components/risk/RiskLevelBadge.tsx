interface RiskLevelBadgeProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  size?: 'sm' | 'md';
}

export function RiskLevelBadge({ level, size = 'md' }: RiskLevelBadgeProps) {
  const getBackgroundColor = () => {
    switch (level) {
      case 'low':
        return 'bg-green-400/20 text-green-400';
      case 'medium':
        return 'bg-neon-amber/20 text-neon-amber';
      case 'high':
        return 'bg-orange-400/20 text-orange-400';
      case 'critical':
        return 'bg-neon-raspberry/20 text-neon-raspberry';
      default:
        return 'bg-gray-400/20 text-gray-400';
    }
  };

  const getSizeClasses = () => {
    return size === 'sm' 
      ? 'text-xs px-2 py-0.5' 
      : 'text-sm px-3 py-1';
  };

  return (
    <span className={`
      inline-flex 
      items-center 
      rounded-full 
      font-medium 
      ${getBackgroundColor()} 
      ${getSizeClasses()}
    `}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}