import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <Icon className="w-12 h-12 text-gray-400 mb-4" />
      
      <h3 className="text-xl font-semibold text-gray-200 mb-2">
        {title}
      </h3>
      
      <p className="text-gray-400 mb-6">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-neon-turquoise text-gunmetal-900 rounded-lg hover:bg-neon-turquoise/90 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}