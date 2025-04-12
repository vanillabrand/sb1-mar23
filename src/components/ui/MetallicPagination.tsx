import React from 'react';
// No chevron icons needed
import { motion } from 'framer-motion';
import { useScreenSize } from '../../lib/hooks/useScreenSize';

interface MetallicPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onReset?: () => void;
  className?: string;
}

export function MetallicPagination({
  currentPage,
  totalPages,
  onPageChange,
  onReset,
  className = ''
}: MetallicPaginationProps) {
  const screenSize = useScreenSize();
  const isMobile = screenSize === 'sm';

  // Don't render if there's only one page
  if (totalPages <= 1) return null;

  const handlePrevious = () => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      onPageChange(currentPage + 1);
    }
  };

  // Reset functionality removed as requested

  // Don't render chevrons on mobile
  if (isMobile) {
    return (
      <div className={`relative ${className} flex justify-center mt-4`}>
        {/* Simple dot pagination for mobile */}
        <div className="flex gap-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => onPageChange(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-neon-turquoise w-8'
                  : 'bg-gunmetal-700'
              }`}
              aria-label={`Go to page ${index + 1}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Desktop version without navigation buttons
  return (
    <div className={`relative ${className} hidden sm:block`}>
      {/* Navigation buttons removed */}
    </div>
  );
}
