import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  itemsPerPage: number;
  totalItems: number;
  loading?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showPageNumbers = false,
  itemsPerPage,
  totalItems,
  loading = false
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 1;
    const pages = [];
    
    for (let i = 0; i < totalPages; i++) {
      if (
        i === 0 ||
        i === totalPages - 1 ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== -1) {
        pages.push(-1);
      }
    }
    
    return pages;
  };

  const startItem = currentPage * itemsPerPage + 1;
  const endItem = Math.min((currentPage + 1) * itemsPerPage, totalItems);

  return (
    <motion.div 
      layout
      className={`flex items-center justify-between px-4 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">
          Showing {startItem} to {endItem} of {totalItems} items
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0 || loading}
          className="p-2 rounded-lg bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {showPageNumbers ? (
            <motion.div 
              className="hidden sm:flex gap-2"
              layout
            >
              {getVisiblePages().map((pageNum, index) => 
                pageNum === -1 ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <motion.button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      pageNum === currentPage
                        ? 'bg-neon-raspberry text-white'
                        : 'bg-gunmetal-800 text-gray-400 hover:text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {pageNum + 1}
                  </motion.button>
                )
              )}
            </motion.div>
          ) : (
            <motion.div 
              className="flex gap-2"
              layout
            >
              {Array.from({ length: totalPages }).map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => onPageChange(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentPage
                      ? 'bg-neon-raspberry w-8'
                      : 'bg-gunmetal-700 hover:bg-gunmetal-600'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage === totalPages - 1 || loading}
          className="p-2 rounded-lg bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
