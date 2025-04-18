import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SMOOTH_EASE } from '../lib/animation-utils';

interface StaggeredContentProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'rotate';
}

/**
 * A component that applies staggered animations to its children
 * with configurable direction and timing.
 */
const StaggeredContent: React.FC<StaggeredContentProps> = ({
  children,
  className = '',
  staggerDelay = 0.08,
  initialDelay = 0.1,
  direction = 'up'
}) => {
  // Define the container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: initialDelay,
        staggerChildren: staggerDelay
      }
    }
  };

  // Define different item animations based on direction
  const getItemVariants = () => {
    switch (direction) {
      case 'up':
        return {
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
      case 'down':
        return {
          hidden: { opacity: 0, y: -20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
      case 'left':
        return {
          hidden: { opacity: 0, x: 20 },
          visible: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
      case 'right':
        return {
          hidden: { opacity: 0, x: -20 },
          visible: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.9 },
          visible: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
      case 'rotate':
        return {
          hidden: { opacity: 0, rotate: -2, scale: 0.98 },
          visible: {
            opacity: 1,
            rotate: 0,
            scale: 1,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
      default:
        return {
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: SMOOTH_EASE }
          }
        };
    }
  };

  // Get the appropriate item variants
  const itemVariants = getItemVariants();

  // Create an array of children with animations
  const animatedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) return child;

    return (
      <motion.div
        variants={itemVariants}
        className="staggered-item"
        style={{ display: 'contents' }}
      >
        {child}
      </motion.div>
    );
  });

  return (
    <motion.div
      className={`staggered-container ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {animatedChildren}
    </motion.div>
  );
};

export default StaggeredContent;
