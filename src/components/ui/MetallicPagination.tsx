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

  // Mobile pagination with improved accessibility
  if (isMobile) {
    return (
      <div className={`relative ${className} flex justify-center mt-4`} role="navigation" aria-label="Pagination">
        {/* Improved mobile pagination */}
        <div className="flex items-center gap-2">
          {/* Previous button */}
          <motion.button
            onClick={handlePrevious}
            disabled={currentPage <= 1}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
              currentPage <= 1 ? 'opacity-50 cursor-not-allowed bg-gunmetal-800' : 'bg-gunmetal-800 hover:bg-gunmetal-700'
            }`}
            whileHover={currentPage > 1 ? { scale: 1.1 } : {}}
            whileTap={currentPage > 1 ? { scale: 0.9 } : {}}
            aria-label="Previous page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>

          {/* Page indicator */}
          <div className="text-sm text-gray-300">
            <span className="font-medium text-neon-turquoise">{currentPage}</span>
            <span className="mx-1">/</span>
            <span>{totalPages}</span>
          </div>

          {/* Next button */}
          <motion.button
            onClick={handleNext}
            disabled={currentPage >= totalPages}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
              currentPage >= totalPages ? 'opacity-50 cursor-not-allowed bg-gunmetal-800' : 'bg-gunmetal-800 hover:bg-gunmetal-700'
            }`}
            whileHover={currentPage < totalPages ? { scale: 1.1 } : {}}
            whileTap={currentPage < totalPages ? { scale: 0.9 } : {}}
            aria-label="Next page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>
      </div>
    );
  }

  // Desktop version with accessible pagination
  return (
    <div className={`relative ${className} hidden sm:flex justify-center mt-4`} role="navigation" aria-label="Pagination">
      <div className="flex gap-3">
        {Array.from({ length: totalPages }).map((_, index) => (
          <motion.button
            key={index}
            onClick={() => onPageChange(index + 1)}
            className={`px-3 py-1 rounded-md transition-all ${
              index + 1 === currentPage
                ? 'bg-neon-turquoise text-gunmetal-900 font-medium'
                : 'bg-gunmetal-800 text-gray-300 hover:bg-gunmetal-700'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`Go to page ${index + 1}`}
            aria-current={index + 1 === currentPage ? 'page' : undefined}
          >
            {index + 1}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
