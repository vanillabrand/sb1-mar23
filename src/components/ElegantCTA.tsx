import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, ArrowRight } from 'lucide-react';

interface ElegantCTAProps {
  onSignUp: () => void;
}

export const ElegantCTA: React.FC<ElegantCTAProps> = ({ onSignUp }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (!containerRef.current || !buttonRef.current) return;
    
    const container = containerRef.current;
    const button = buttonRef.current;
    
    // Button hover effect
    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate distance from center
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const distanceX = x - centerX;
      const distanceY = y - centerY;
      
      // Apply magnetic effect (subtle pull toward cursor)
      gsap.to(button, {
        x: distanceX * 0.1,
        y: distanceY * 0.1,
        duration: 0.3,
        ease: 'power2.out'
      });
      
      // Highlight effect
      const highlight = button.querySelector('.btn-highlight') as HTMLElement;
      if (highlight) {
        gsap.to(highlight, {
          opacity: 0.2,
          x: x,
          y: y,
          duration: 0.3
        });
      }
    };
    
    const handleMouseLeave = () => {
      gsap.to(button, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)'
      });
      
      const highlight = button.querySelector('.btn-highlight') as HTMLElement;
      if (highlight) {
        gsap.to(highlight, {
          opacity: 0,
          duration: 0.3
        });
      }
    };
    
    button.addEventListener('mousemove', handleMouseMove);
    button.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      button.removeEventListener('mousemove', handleMouseMove);
      button.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-8 md:p-12"
    >
      {/* Glass reflections */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-medium mb-4 text-white">
            Ready to transform your trading approach?
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Join thousands of traders who are already using AI to achieve their financial goals.
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex justify-center"
        >
          <button
            ref={buttonRef}
            onClick={onSignUp}
            className="relative overflow-hidden group flex items-center gap-3 px-6 py-3 bg-neon-magenta text-white rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(255,20,147,0.3)]"
          >
            {/* Button highlight effect */}
            <div className="btn-highlight absolute w-20 h-20 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none blur-md" />
            
            <Brain className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-medium">Start your AI trading journey</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ElegantCTA;
