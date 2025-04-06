import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface PanelWrapperProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
  delay?: number;
  title?: string;
  icon?: React.ReactNode;
}

export function PanelWrapper({
  children,
  index = 0,
  className = "",
  delay = 0,
  title,
  icon
}: PanelWrapperProps) {
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
                duration: 0,
                delay: 0,
                ease: [0, 0, 1, 1]
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
      className={`panel-metallic backdrop-blur-xl rounded-xl p-4 sm:p-6 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-3 mb-6">
          {icon && <div className="text-neon-orange">{icon}</div>}
          <h2 className="gradient-text">{title}</h2>
        </div>
      )}
      {children}
    </motion.div>
  );
}
