import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeHintProps {
  className?: string;
}

export function SwipeHint({ className = '' }: SwipeHintProps) {
  const [isVisible, setIsVisible] = useState(true);
  const controls = useAnimation();

  useEffect(() => {
    // Sequence of animations to show a subtle swipe hint
    const runAnimation = async () => {
      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Run the animation sequence 3 times
      for (let i = 0; i < 3; i++) {
        // Animate left
        await controls.start({
          x: -20,
          opacity: 0.9,
          transition: { duration: 0.5, ease: "easeInOut" }
        });
        
        // Return to center
        await controls.start({
          x: 0,
          opacity: 1,
          transition: { duration: 0.3, ease: "easeOut" }
        });
        
        // Animate right
        await controls.start({
          x: 20,
          opacity: 0.9,
          transition: { duration: 0.5, ease: "easeInOut" }
        });
        
        // Return to center
        await controls.start({
          x: 0,
          opacity: 1,
          transition: { duration: 0.3, ease: "easeOut" }
        });
        
        // Pause between sequences
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // Fade out after animations complete
      await controls.start({
        opacity: 0,
        transition: { duration: 0.5, delay: 0.5 }
      });
      
      setIsVisible(false);
    };
    
    runAnimation();
  }, [controls]);
  
  if (!isVisible) return null;
  
  return (
    <motion.div 
      className={`absolute inset-0 pointer-events-none flex items-center justify-center ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="bg-black/40 backdrop-blur-sm rounded-full px-6 py-3 flex items-center gap-3"
        animate={controls}
      >
        <ChevronLeft className="w-5 h-5 text-gray-300" />
        <div className="w-6 h-1 bg-gray-300 rounded-full"></div>
        <ChevronRight className="w-5 h-5 text-gray-300" />
      </motion.div>
    </motion.div>
  );
}
