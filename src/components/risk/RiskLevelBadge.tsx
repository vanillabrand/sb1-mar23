import React from 'react';
import type { RiskLevel } from '../../lib/types';

interface RiskLevelBadgeProps {
  riskLevel: RiskLevel | string;
  size?: 'sm' | 'md';
}

export function RiskLevelBadge({ riskLevel, size = 'md' }: RiskLevelBadgeProps) {
  const getBackgroundColor = () => {
    // Convert to lowercase for case-insensitive comparison
    const level = typeof riskLevel === 'string' ? riskLevel.toLowerCase() : 'medium';

    switch (level) {
      case 'low':
      case 'ultra low':
        return 'bg-green-400/20 text-green-400';
      case 'medium':
        return 'bg-neon-amber/20 text-neon-amber';
      case 'high':
      case 'ultra high':
        return 'bg-orange-400/20 text-orange-400';
      case 'critical':
      case 'extreme':
      case 'god mode':
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
      {typeof riskLevel === 'string'
        ? riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase()
        : 'Medium'}
    </span>
  );
}