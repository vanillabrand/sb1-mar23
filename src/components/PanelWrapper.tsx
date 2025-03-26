import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface PanelWrapperProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
  delay?: number;
}

export function PanelWrapper({ 
  children, 
  index = 0, 
  className = "",
  delay = 0 
}: PanelWrapperProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  // Handle mouse move effect
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    panelRef.current.style.setProperty('--mouse-x', `${x}%`);
    panelRef.current.style.setProperty('--mouse-y', `${y}%`);
  };

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
                duration: 0.5,
                delay: delay + index * 0.1,
                ease: [0.4, 0, 0.2, 1]
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
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (panelRef.current) {
          panelRef.current.style.setProperty('--mouse-x', '50%');
          panelRef.current.style.setProperty('--mouse-y', '50%');
        }
      }}
      className={`panel-metallic ${className}`}
    >
      {children}
    </motion.div>
  );
}
