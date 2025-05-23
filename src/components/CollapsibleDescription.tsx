import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { incrementViewCounter, shouldShowElement } from '../lib/view-counter';

interface CollapsibleDescriptionProps {
  id: string;
  maxViews?: number;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleDescription({
  id,
  maxViews = 5,
  children,
  className = '',
}: CollapsibleDescriptionProps) {
  // State to track if the description is expanded
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // On mount, check if we should show the description based on view count
  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const shouldShow = shouldShowElement(id, maxViews);
      setIsExpanded(shouldShow);

      // If we're showing it, increment the view counter
      if (shouldShow) {
        incrementViewCounter(id);
      }
    }
  }, [id, maxViews]);

  return (
    <div className={`relative collapsible-description ${isExpanded ? 'is-expanded' : 'is-collapsed'} ${className}`}>
      <div className="flex flex-col">
        {/* Description content */}
        <div
          className={`transition-all duration-300 overflow-hidden ${
            isExpanded ? 'max-h-96 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'
          }`}
        >
          {children}
        </div>

        {/* Toggle button removed as requested */}
      </div>

      {/* No gradient overlay in collapsed state */}
    </div>
  );
}
