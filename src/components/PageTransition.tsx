import React, { ReactNode, useMemo } from 'react';
import { motion, Variants, LazyMotion, domAnimation } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { SMOOTH_EASE } from '../lib/animation-utils';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * A wrapper component that applies smooth page transition animations
 * to its children when navigating between routes.
 * Each page has a unique animation style.
 */
const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = ''
}) => {
  const location = useLocation();

  // Create different animation variants for each page
  const variants = useMemo(() => {
    // Extract the page name from the path
    const path = location.pathname;

    // Default transition settings
    const duration = 0.4;
    const ease = SMOOTH_EASE;

    // Different animation for each page
    if (path === '/' || path === '/dashboard') {
      // Dashboard: Fade up from bottom
      return {
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          y: -20,
          transition: { duration: 0.3, ease }
        }
      };
    } else if (path === '/strategy-manager') {
      // Strategy Manager: Scale and fade
      return {
        hidden: { opacity: 0, scale: 0.96 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          scale: 1.02,
          transition: { duration: 0.3, ease }
        }
      };
    } else if (path === '/backtest') {
      // Backtest: Slide in from right
      return {
        hidden: { opacity: 0, x: 50 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          x: -30,
          transition: { duration: 0.3, ease }
        }
      };
    } else if (path === '/trade-monitor') {
      // Trade Monitor: Fade in with slight rotation
      return {
        hidden: { opacity: 0, y: 20, rotateX: 5 },
        visible: {
          opacity: 1,
          y: 0,
          rotateX: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          y: -10,
          transition: { duration: 0.3, ease }
        }
      };
    } else if (path === '/risk-manager') {
      // Risk Manager: Slide in from left
      return {
        hidden: { opacity: 0, x: -50 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          x: 30,
          transition: { duration: 0.3, ease }
        }
      };
    } else if (path === '/exchange-manager') {
      // Exchange Manager: Fade in with slight scale
      return {
        hidden: { opacity: 0, scale: 0.98, y: 10 },
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          scale: 1.02,
          y: -10,
          transition: { duration: 0.3, ease }
        }
      };
    } else if (path === '/analytics') {
      // Analytics: Fade in with slight rotation and scale
      return {
        hidden: { opacity: 0, scale: 0.95, rotateY: 2 },
        visible: {
          opacity: 1,
          scale: 1,
          rotateY: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          scale: 1.03,
          rotateY: -2,
          transition: { duration: 0.3, ease }
        }
      };
    } else {
      // Default animation for other pages
      return {
        hidden: { opacity: 0, y: 15 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease }
        },
        exit: {
          opacity: 0,
          y: -15,
          transition: { duration: 0.3, ease }
        }
      };
    }
  }, [location.pathname]);

  return (
    <LazyMotion features={domAnimation}>
      <motion.div
        className={`w-full h-full flex-1 ${className}`}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minHeight: '100%'
        }}
      >
        {children}
      </motion.div>
    </LazyMotion>
  );
};

export default PageTransition;
