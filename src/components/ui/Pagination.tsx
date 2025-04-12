import React from 'react';
// No chevron icons needed
import { motion, AnimatePresence } from 'framer-motion';
import { useScreenSize } from '../../lib/hooks/useScreenSize';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  itemsPerPage?: number;
  totalItems?: number;
  loading?: boolean;
  showItemsPerPage?: boolean;
  itemsPerPageOptions?: number[];
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showPageNumbers = true,
  itemsPerPage = 6,
  totalItems,
  loading = false,
  showItemsPerPage = false,
  itemsPerPageOptions = [6, 12, 24],
  onItemsPerPageChange
}: PaginationProps) {
  const screenSize = useScreenSize();
  const isMobile = screenSize === 'sm';

  // Don't render pagination on mobile or if there's only one page
  if (isMobile || totalPages <= 1) return null;

  // Calculate page numbers to show
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; // Show at most 5 page numbers

    if (totalPages <= maxPagesToShow) {
      // If we have 5 or fewer pages, show all of them
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always include first page
      pageNumbers.push(1);

      // Calculate start and end of page range
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if we're at the beginning or end
      if (currentPage <= 2) {
        end = 3;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 2;
      }

      // Add ellipsis if needed
      if (start > 2) {
        pageNumbers.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pageNumbers.push('...');
      }

      // Always include last page
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  // Handle items per page change
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newItemsPerPage = parseInt(e.target.value, 10);
    if (onItemsPerPageChange) {
      onItemsPerPageChange(newItemsPerPage);
    }
  };

  // Calculate start and end items for display
  const startItem = totalItems ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = totalItems ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  return (
    <motion.div
      layout
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 ${className}`}
    >
      {/* Items per page selector */}
      {showItemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Show:</span>
          <select
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            className="bg-gunmetal-800 text-white rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-neon-turquoise"
          >
            {itemsPerPageOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Page info */}
      {totalItems !== undefined && (
        <div className="text-sm text-gray-400">
          Showing {startItem} - {endItem} of {totalItems}
        </div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center gap-1">
        {/* Previous button removed */}

        {/* Page numbers */}
        <AnimatePresence mode="sync">
          {showPageNumbers ? (
            <motion.div
              className="flex items-center gap-1"
              layout
              key="page-numbers"
            >
              {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {typeof page === 'number' ? (
                    <motion.button
                      onClick={() => onPageChange(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all duration-300 ${
                        currentPage === page
                          ? 'bg-neon-turquoise text-black font-medium scale-110'
                          : 'text-gray-300 hover:bg-gunmetal-800'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={`Page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </motion.button>
                  ) : (
                    <span className="w-8 flex items-center justify-center text-gray-500">
                      {page}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="flex gap-2"
              layout
              key="dots"
            >
              {Array.from({ length: totalPages }).map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => onPageChange(index + 1)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index + 1 === currentPage
                      ? 'bg-neon-turquoise w-8'
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

        {/* Next button removed */}
      </div>
    </motion.div>
  );
}
