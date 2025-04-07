import React, { useState, useRef, useEffect } from 'react';
import { motion, PanInfo, useAnimation, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScreenSize } from '../../lib/hooks/useScreenSize';
import { SwipeHint } from './SwipeHint';
import { MetallicPagination } from './MetallicPagination';

interface SwipeableCardListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function SwipeableCardList<T>({
  items,
  renderItem,
  itemsPerPage,
  currentPage,
  totalPages,
  onPageChange,
  className = ''
}: SwipeableCardListProps<T>) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const startX = useRef(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const screenSize = useScreenSize();
  const isMobile = screenSize === 'sm';

  // Handle swipe gestures
  const handleDragStart = (_: any, info: PanInfo) => {
    setIsDragging(true);
    startX.current = info.point.x;
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    const dragDistance = info.point.x - startX.current;
    const threshold = 100; // Minimum distance to trigger page change

    if (dragDistance > threshold && currentPage > 0) {
      // Swiped right - go to previous page
      onPageChange(currentPage - 1);
    } else if (dragDistance < -threshold && currentPage < totalPages - 1) {
      // Swiped left - go to next page
      onPageChange(currentPage + 1);
    } else {
      // Reset position if threshold not met
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
    }
  };

  // Handle touch events for mobile
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      setTouchEndX(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      const swipeDistance = touchEndX - touchStartX;
      const threshold = 70; // Minimum distance to trigger page change

      if (swipeDistance > threshold && currentPage > 0) {
        // Swiped right - go to previous page
        onPageChange(currentPage - 1);
      } else if (swipeDistance < -threshold && currentPage < totalPages - 1) {
        // Swiped left - go to next page
        onPageChange(currentPage + 1);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart);
      container.addEventListener('touchmove', handleTouchMove);
      container.addEventListener('touchend', handleTouchEnd);

      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [currentPage, totalPages, touchStartX, touchEndX, onPageChange]);

  // Calculate visible items for current page
  const visibleItems = items.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Hide swipe hint after first successful swipe
  useEffect(() => {
    if (currentPage > 0) {
      setShowSwipeHint(false);
    }
  }, [currentPage]);

  return (
    <div className={`${className} relative`}>
      {/* Metallic pagination with tabs */}
      <MetallicPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />

      {/* Swipeable container */}
      <motion.div
        ref={containerRef}
        className="overflow-hidden touch-pan-y"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
      >
        <div className="grid grid-cols-1 gap-3 pt-8 pb-4">
          {visibleItems.map((item, index) => (
            <div key={index} className={isDragging ? 'pointer-events-none' : ''}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>

        {/* Animated swipe hint for mobile - only shows on first load */}
        <AnimatePresence>
          {isMobile && showSwipeHint && totalPages > 1 && (
            <SwipeHint />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
