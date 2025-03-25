import React from 'react';
import { motion } from 'framer-motion';

interface PanelWrapperProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

export function PanelWrapper({ children, index = 0, className = "" }: PanelWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={`panel-stagger-enter ${className}`}
    >
      {children}
    </motion.div>
  );
}