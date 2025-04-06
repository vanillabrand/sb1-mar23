import React from 'react';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
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

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onPageChange(0);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Left metal tab with chevron */}
      <motion.div
        className={`absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 z-10
                   bg-gunmetal-800/80 rounded-l-lg shadow-md cursor-pointer
                   ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-150'}`}
        onClick={handlePrevious}
        style={{ position: 'fixed' }}
      >
        <div className="px-2 py-8 flex items-center justify-center">
          <ChevronLeft className={`w-6 h-6 ${currentPage === 0 ? 'text-gray-500' : 'text-gray-300'}`} />
        </div>
      </motion.div>

      {/* Right metal tab with chevron */}
      <motion.div
        className={`absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 z-10
                   bg-gunmetal-800/80 rounded-r-lg shadow-md cursor-pointer
                   ${currentPage === totalPages - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-150'}`}
        onClick={handleNext}
        style={{ position: 'fixed' }}
      >
        <div className="px-2 py-8 flex items-center justify-center">
          <ChevronRight className={`w-6 h-6 ${currentPage === totalPages - 1 ? 'text-gray-500' : 'text-gray-300'}`} />
        </div>
      </motion.div>

      {/* Home button at top right */}
      <motion.div
        className="absolute right-2 top-2 z-10 bg-gunmetal-800/80 rounded-full p-1 shadow-md cursor-pointer hover:brightness-150"
        whileHover={{ scale: 1.05 }}
        onClick={handleReset}
      >
        <Home className="w-4 h-4 text-gray-300" />
      </motion.div>

      {/* Page indicator - now shown on all devices and centered at bottom */}
      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 font-light">
        {currentPage + 1} / {totalPages}
      </div>
    </div>
  );
}
