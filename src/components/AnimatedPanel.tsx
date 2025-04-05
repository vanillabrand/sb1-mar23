import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface AnimatedPanelProps {
  children: React.ReactNode;
  index: number;
  className?: string;
  delay?: number;
}

export function AnimatedPanel({
  children,
  index,
  className = "",
  delay = 0
}: AnimatedPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  // Trigger entrance animation when component enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            controls.start({
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.3, // Animation duration of 0.3 seconds
                delay: delay + index * 0.2, // Stagger by 0.2 seconds per panel
                ease: [0.4, 0, 0.2, 1] // Smooth easing
              }
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (panelRef.current) {
      observer.observe(panelRef.current);
    }

    return () => observer.disconnect();
  }, [controls, index, delay]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 20 }}
      animate={controls}
      className={className}
    >
      {children}
    </motion.div>
  );
}
