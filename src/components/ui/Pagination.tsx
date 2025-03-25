import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showPageNumbers = false
}: PaginationProps) {
  // Don't show pagination if there's only one page
  if (totalPages <= 1) return null;

  // Calculate visible page numbers
  const getVisiblePages = () => {
    const delta = 1; // Number of pages to show on each side of current page
    const pages = [];
    
    for (let i = 0; i < totalPages; i++) {
      if (
        i === 0 || // First page
        i === totalPages - 1 || // Last page
        (i >= currentPage - delta && i <= currentPage + delta) // Pages around current
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== -1) {
        pages.push(-1); // Add ellipsis marker
      }
    }
    
    return pages;
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <button
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className="p-2 rounded-lg bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {showPageNumbers ? (
        <div className="hidden sm:flex gap-2">
          {getVisiblePages().map((pageNum, index) => 
            pageNum === -1 ? (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg transition-all ${
                  pageNum === currentPage
                    ? 'bg-neon-raspberry text-white'
                    : 'bg-gunmetal-800 text-gray-400 hover:text-white'
                }`}
              >
                {pageNum + 1}
              </button>
            )
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => onPageChange(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-neon-raspberry w-8'
                  : 'bg-gunmetal-700 hover:bg-gunmetal-600'
              }`}
              aria-label={`Go to page ${index + 1}`}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage === totalPages - 1}
        className="p-2 rounded-lg bg-gunmetal-800 text-gray-400 hover:text-neon-turquoise transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}