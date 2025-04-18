import { useEffect, useState } from 'react';
import { Variants } from 'framer-motion';
import { 
  fadeUpVariants, 
  cardVariants, 
  staggerContainerVariants,
  buttonVariants,
  controlsVariants,
  modalVariants,
  listItemVariants,
  tableRowVariants,
  pageTransitionVariants,
  chartContainerVariants,
  tradeCardVariants,
  statCardVariants,
  menuItemVariants,
  toastVariants,
  createCustomVariant
} from '../lib/animation-utils';

/**
 * Animation types available in the application
 */
export type AnimationType = 
  | 'fadeUp'
  | 'card'
  | 'staggerContainer'
  | 'button'
  | 'controls'
  | 'modal'
  | 'listItem'
  | 'tableRow'
  | 'pageTransition'
  | 'chart'
  | 'tradeCard'
  | 'statCard'
  | 'menuItem'
  | 'toast'
  | 'custom';

/**
 * Custom hook to get animation variants based on type
 * @param type The type of animation to use
 * @param customParams Optional custom parameters for 'custom' type
 * @returns Animation variants object
 */
export const useAnimationConfig = (
  type: AnimationType = 'fadeUp',
  customParams?: Parameters<typeof createCustomVariant>[0]
): {
  variants: Variants;
  initial: string | object;
  animate: string | object;
  exit?: string | object;
  transition?: object;
  whileHover?: string | object;
  whileTap?: string | object;
} => {
  // Get the appropriate variants based on type
  const getVariants = (): Variants => {
    switch (type) {
      case 'fadeUp':
        return fadeUpVariants;
      case 'card':
        return cardVariants;
      case 'staggerContainer':
        return staggerContainerVariants;
      case 'button':
        return buttonVariants;
      case 'controls':
        return controlsVariants;
      case 'modal':
        return modalVariants;
      case 'listItem':
        return listItemVariants;
      case 'tableRow':
        return tableRowVariants;
      case 'pageTransition':
        return pageTransitionVariants;
      case 'chart':
        return chartContainerVariants;
      case 'tradeCard':
        return tradeCardVariants;
      case 'statCard':
        return statCardVariants;
      case 'menuItem':
        return menuItemVariants;
      case 'toast':
        return toastVariants;
      case 'custom':
        return customParams ? createCustomVariant(customParams) : fadeUpVariants;
      default:
        return fadeUpVariants;
    }
  };

  const variants = getVariants();
  
  // Determine if this animation type has hover/tap states
  const hasHover = 'hover' in variants;
  const hasTap = 'tap' in variants;
  const hasExit = 'exit' in variants;

  return {
    variants,
    initial: 'hidden',
    animate: 'visible',
    ...(hasExit && { exit: 'exit' }),
    ...(hasHover && { whileHover: 'hover' }),
    ...(hasTap && { whileTap: 'tap' })
  };
};

/**
 * Hook to create staggered animations for lists
 * @param items Array of items to animate
 * @param type Animation type to use
 * @param staggerDelay Delay between each item animation
 * @returns Animation props for container and items
 */
export const useStaggeredAnimation = <T>(
  items: T[],
  type: AnimationType = 'card',
  staggerDelay = 0.08
) => {
  const containerAnimation = useAnimationConfig('staggerContainer');
  const itemAnimation = useAnimationConfig(type);
  
  return {
    containerProps: containerAnimation,
    getItemProps: (index: number) => ({
      ...itemAnimation,
      custom: index,
    })
  };
};

/**
 * Hook to create a delayed animation
 * @param delay Delay in seconds before animation starts
 * @param type Animation type to use
 * @returns Animation props with delay
 */
export const useDelayedAnimation = (
  delay: number = 0.3,
  type: AnimationType = 'fadeUp'
) => {
  const animation = useAnimationConfig(type);
  
  return {
    ...animation,
    transition: {
      ...animation.transition,
      delay
    }
  };
};

/**
 * Hook to create animations that trigger when element is in viewport
 * @param type Animation type to use
 * @param threshold Intersection threshold (0-1)
 * @returns Animation props and ref to attach to element
 */
export const useInViewAnimation = (
  type: AnimationType = 'fadeUp',
  threshold: number = 0.1
) => {
  const [isInView, setIsInView] = useState(false);
  const animation = useAnimationConfig(type);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
          }
        });
      },
      { threshold }
    );
    
    return () => observer.disconnect();
  }, [threshold]);
  
  return {
    ...animation,
    animate: isInView ? 'visible' : 'hidden',
    ref: (element: Element | null) => {
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setIsInView(true);
              }
            });
          },
          { threshold }
        );
        observer.observe(element);
      }
    }
  };
};
