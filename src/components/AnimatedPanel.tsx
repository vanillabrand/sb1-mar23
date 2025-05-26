import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { SMOOTH_EASE } from '../lib/animation-utils';

interface AnimatedPanelProps {
  children: React.ReactNode;
  index: number;
  className?: string;
  delay?: number;
  animationType?: 'fade' | 'slide' | 'scale' | 'rotate' | 'random';
}

export function AnimatedPanel({
  children,
  index,
  className = "",
  delay = 0,
  animationType = 'random'
}: AnimatedPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [isVisible, setIsVisible] = useState(false);

  // Determine animation type
  const getAnimationType = () => {
    if (animationType !== 'random') return animationType;

    // Random animation based on index to ensure consistency
    const types = ['fade', 'slide', 'scale', 'rotate'];
    return types[index % types.length];
  };

  const type = getAnimationType();

  // Get initial and animate values based on animation type
  const getAnimationProps = () => {
    switch (type) {
      case 'fade':
        return {
          initial: { opacity: 0, y: 20 },
          animate: {
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.4,
              delay: 0.2 + (index * 0.2), // Increased stagger delay for more pronounced effect
              ease: SMOOTH_EASE
            }
          }
        };
      case 'slide':
        return {
          initial: { opacity: 0, x: index % 2 === 0 ? -30 : 30 },
          animate: {
            opacity: 1,
            x: 0,
            transition: {
              duration: 0.5,
              delay: 0.2 + (index * 0.2),
              ease: SMOOTH_EASE
            }
          }
        };
      case 'scale':
        return {
          initial: { opacity: 0, scale: 0.95, y: 15 }, // Added y movement for better effect
          animate: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
              duration: 0.5,
              delay: 0.2 + (index * 0.2),
              ease: SMOOTH_EASE
            }
          }
        };
      case 'rotate':
        return {
          initial: { opacity: 0, rotate: index % 2 === 0 ? -2 : 2, y: 20 },
          animate: {
            opacity: 1,
            rotate: 0,
            y: 0,
            transition: {
              duration: 0.5,
              delay: 0.2 + (index * 0.2),
              ease: SMOOTH_EASE
            }
          }
        };
      default:
        return {
          initial: { opacity: 0, y: 20 },
          animate: {
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.4,
              delay: 0.2 + (index * 0.2),
              ease: SMOOTH_EASE
            }
          }
        };
    }
  };

  const { initial, animate } = getAnimationProps();

  // Trigger entrance animation when component enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            controls.start(animate);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (panelRef.current) {
      observer.observe(panelRef.current);
    }

    return () => observer.disconnect();
  }, [controls, animate]);

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={initial}
        animate={controls}
        className={`${className}`} // Removed tween-effect class and hover effects
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
