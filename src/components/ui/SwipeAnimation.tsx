import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface SwipeAnimationProps {
  children: React.ReactNode;
  className?: string;
  onComplete?: () => void;
}

/**
 * A component that applies a subtle swipe animation to its children
 * to indicate that the content is swipeable.
 */
export function SwipeAnimation({ children, className = '', onComplete }: SwipeAnimationProps) {
  const controls = useAnimation();
  
  useEffect(() => {
    const runAnimation = async () => {
      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Subtle right movement
      await controls.start({
        x: 10,
        transition: { duration: 0.7, ease: "easeInOut" }
      });
      
      // Return to center
      await controls.start({
        x: 0,
        transition: { duration: 0.5, ease: "easeOut" }
      });
      
      // Subtle left movement
      await controls.start({
        x: -10,
        transition: { duration: 0.7, ease: "easeInOut" }
      });
      
      // Return to center
      await controls.start({
        x: 0,
        transition: { duration: 0.5, ease: "easeOut" }
      });
      
      // Notify parent component that animation is complete
      if (onComplete) {
        onComplete();
      }
    };
    
    runAnimation();
  }, [controls, onComplete]);
  
  return (
    <motion.div 
      className={className}
      animate={controls}
    >
      {children}
    </motion.div>
  );
}
