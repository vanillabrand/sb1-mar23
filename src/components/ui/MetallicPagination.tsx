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

  // Desktop version with text buttons instead of chevrons
  return (
    <div className={`relative ${className} hidden sm:block`}>
      {/* Previous button */}
      <motion.div
        className={`absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 z-10
                   bg-gunmetal-800/80 rounded-lg shadow-md cursor-pointer
                   ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-150'}`}
        onClick={handlePrevious}
        style={{ position: 'fixed' }}
      >
        <div className="px-4 py-2 flex items-center justify-center">
          <span className={`text-sm ${currentPage === 0 ? 'text-gray-500' : 'text-gray-300'}`}>Prev</span>
        </div>
      </motion.div>

      {/* Next button */}
      <motion.div
        className={`absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 z-10
                   bg-gunmetal-800/80 rounded-lg shadow-md cursor-pointer
                   ${currentPage === totalPages - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-150'}`}
        onClick={handleNext}
        style={{ position: 'fixed' }}
      >
        <div className="px-4 py-2 flex items-center justify-center">
          <span className={`text-sm ${currentPage === totalPages - 1 ? 'text-gray-500' : 'text-gray-300'}`}>Next</span>
        </div>
      </motion.div>
    </div>
  );
}
