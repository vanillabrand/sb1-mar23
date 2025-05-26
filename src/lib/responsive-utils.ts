/**
 * Responsive design utilities for the adaptive crypto trading platform
 */
import { useState, useEffect } from 'react';

// Breakpoints following standard conventions
export const BREAKPOINTS = {
  xs: 320,   // Extra small devices (phones)
  sm: 640,   // Small devices (large phones)
  md: 768,   // Medium devices (tablets)
  lg: 1024,  // Large devices (laptops)
  xl: 1280,  // Extra large devices (desktops)
  '2xl': 1536 // 2X large devices (large desktops)
} as const;

// Media query helpers
export const mediaQueries = {
  xs: `(min-width: ${BREAKPOINTS.xs}px)`,
  sm: `(min-width: ${BREAKPOINTS.sm}px)`,
  md: `(min-width: ${BREAKPOINTS.md}px)`,
  lg: `(min-width: ${BREAKPOINTS.lg}px)`,
  xl: `(min-width: ${BREAKPOINTS.xl}px)`,
  '2xl': `(min-width: ${BREAKPOINTS['2xl']}px)`,

  // Max width queries
  maxXs: `(max-width: ${BREAKPOINTS.xs - 1}px)`,
  maxSm: `(max-width: ${BREAKPOINTS.sm - 1}px)`,
  maxMd: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  maxLg: `(max-width: ${BREAKPOINTS.lg - 1}px)`,
  maxXl: `(max-width: ${BREAKPOINTS.xl - 1}px)`,

  // Range queries
  smToMd: `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.md - 1}px)`,
  mdToLg: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  lgToXl: `(min-width: ${BREAKPOINTS.lg}px) and (max-width: ${BREAKPOINTS.xl - 1}px)`
} as const;

// Hook to get current screen size
export function useResponsive() {
  const [screenSize, setScreenSize] = useState<keyof typeof BREAKPOINTS>('md');

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;

      if (width >= BREAKPOINTS['2xl']) {
        setScreenSize('2xl');
      } else if (width >= BREAKPOINTS.xl) {
        setScreenSize('xl');
      } else if (width >= BREAKPOINTS.lg) {
        setScreenSize('lg');
      } else if (width >= BREAKPOINTS.md) {
        setScreenSize('md');
      } else if (width >= BREAKPOINTS.sm) {
        setScreenSize('sm');
      } else {
        setScreenSize('xs');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);

    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return {
    screenSize,
    isMobile: screenSize === 'xs' || screenSize === 'sm',
    isTablet: screenSize === 'md',
    isDesktop: screenSize === 'lg' || screenSize === 'xl' || screenSize === '2xl',
    isLargeDesktop: screenSize === 'xl' || screenSize === '2xl'
  };
}

// Responsive grid utilities
export const gridCols = {
  xs: 'grid-cols-1',
  sm: 'grid-cols-1 sm:grid-cols-2',
  md: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  lg: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  xl: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
} as const;

// Responsive spacing utilities
export const spacing = {
  xs: 'p-2 sm:p-4',
  sm: 'p-4 sm:p-6',
  md: 'p-4 sm:p-6 md:p-8',
  lg: 'p-6 sm:p-8 md:p-10',
  xl: 'p-8 sm:p-10 md:p-12'
} as const;

// Responsive text sizes
export const textSizes = {
  xs: 'text-xs sm:text-sm',
  sm: 'text-sm sm:text-base',
  base: 'text-base sm:text-lg',
  lg: 'text-lg sm:text-xl',
  xl: 'text-xl sm:text-2xl',
  '2xl': 'text-2xl sm:text-3xl',
  '3xl': 'text-3xl sm:text-4xl'
} as const;

// Touch-friendly sizing for mobile
export const touchTargets = {
  small: 'min-h-[44px] min-w-[44px]',  // iOS minimum
  medium: 'min-h-[48px] min-w-[48px]', // Android minimum
  large: 'min-h-[56px] min-w-[56px]'   // Comfortable size
} as const;

// Responsive container utilities
export const containers = {
  full: 'w-full',
  sm: 'w-full max-w-sm mx-auto',
  md: 'w-full max-w-md mx-auto',
  lg: 'w-full max-w-lg mx-auto',
  xl: 'w-full max-w-xl mx-auto',
  '2xl': 'w-full max-w-2xl mx-auto',
  '3xl': 'w-full max-w-3xl mx-auto',
  '4xl': 'w-full max-w-4xl mx-auto',
  '5xl': 'w-full max-w-5xl mx-auto',
  '6xl': 'w-full max-w-6xl mx-auto',
  '7xl': 'w-full max-w-7xl mx-auto'
} as const;

// Experience mode specific responsive utilities
export const experienceModeLayouts = {
  beginner: {
    container: containers['4xl'],
    grid: 'grid-cols-1 lg:grid-cols-2',
    spacing: spacing.md,
    textSize: textSizes.base
  },
  intermediate: {
    container: containers['6xl'],
    grid: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    spacing: spacing.md,
    textSize: textSizes.sm
  },
  expert: {
    container: containers['7xl'],
    grid: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    spacing: spacing.sm,
    textSize: textSizes.xs
  }
} as const;

// Utility function to get responsive classes based on experience mode
export function getResponsiveClasses(mode: 'beginner' | 'intermediate' | 'expert') {
  return experienceModeLayouts[mode];
}

// Utility function to check if device supports hover
export function supportsHover(): boolean {
  return window.matchMedia('(hover: hover)').matches;
}

// Utility function to check if device has fine pointer (mouse)
export function hasFinePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches;
}

// Utility function to get optimal column count based on screen size and content
export function getOptimalColumns(screenWidth: number, minItemWidth: number = 300): number {
  const availableWidth = screenWidth - 64; // Account for padding
  return Math.max(1, Math.floor(availableWidth / minItemWidth));
}


