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
            // Use a consistent animation for all panels
            controls.start({
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.3, // Consistent duration
                delay: 0, // No delay based on index
                ease: "easeOut" // Consistent easing
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
  }, [controls]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 10 }} // Reduced initial offset for more subtle animation
      animate={controls}
      className={className}
    >
      {children}
    </motion.div>
  );
}
