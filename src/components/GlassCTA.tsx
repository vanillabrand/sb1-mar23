import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, ArrowRight } from 'lucide-react';

interface GlassCTAProps {
  onSignUp: () => void;
}

export const GlassCTA: React.FC<GlassCTAProps> = ({ onSignUp }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (!containerRef.current || !buttonRef.current) return;
    
    const container = containerRef.current;
    const button = buttonRef.current;
    
    // Create particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute rounded-full bg-white/20 pointer-events-none';
      
      // Randomize particle properties
      const size = Math.random() * 6 + 2;
      
      // Set particle styles
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.opacity = '0';
      
      container.appendChild(particle);
      
      // Animate particle
      gsap.to(particle, {
        y: -100 - Math.random() * 100,
        x: Math.sin(Math.random() * 10) * 30,
        opacity: 0.3,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 4,
        repeat: -1,
        repeatDelay: Math.random() * 2,
        ease: 'power1.out'
      });
    }
    
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
      className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/[0.03] border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 md:p-12"
    >
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">
            Ready to Transform Your Trading?
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
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
            className="relative overflow-hidden group flex items-center gap-3 px-8 py-4 bg-neon-magenta text-white rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(255,20,147,0.3)]"
          >
            {/* Button highlight effect */}
            <div className="btn-highlight absolute w-20 h-20 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none" />
            
            <Brain className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-medium">Start Your AI Trading Journey</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default GlassCTA;
