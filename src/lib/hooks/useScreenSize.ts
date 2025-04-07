import { useState, useEffect } from 'react';

export type ScreenSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>('lg');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setScreenSize('sm');
      else if (width < 768) setScreenSize('md');
      else if (width < 1024) setScreenSize('lg');
      else if (width < 1280) setScreenSize('xl');
      else setScreenSize('2xl');
    };

    // Initial check
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenSize;
}

export const ITEMS_PER_PAGE = {
  sm: 6,  // Mobile - updated to show 6 strategies at a time
  md: 6,  // Tablet
  lg: 6,  // Desktop
  xl: 6,  // Large Desktop
  '2xl': 6 // Extra Large Desktop
};