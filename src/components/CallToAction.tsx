import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain } from 'lucide-react';

export const CallToAction: React.FC<{ onSignUp: () => void }> = ({ onSignUp }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  
  // Create particle animation
  useEffect(() => {
    if (!particlesRef.current || !containerRef.current) return;
    
    const particles = particlesRef.current;
    const container = containerRef.current;
    
    // Create particles
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute rounded-full';
      
      // Randomize particle properties
      const size = Math.random() * 4 + 1;
      const posX = Math.random() * 100;
      const posY = Math.random() * 100;
      const duration = Math.random() * 20 + 10;
      const delay = Math.random() * 5;
      
      // Set particle styles
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${posX}%`;
      particle.style.top = `${posY}%`;
      
      // Randomize particle color
      const colors = [
        'bg-neon-cyan', 
        'bg-neon-magenta', 
        'bg-neon-yellow'
      ];
      particle.classList.add(colors[Math.floor(Math.random() * colors.length)]);
      particle.style.opacity = (Math.random() * 0.5 + 0.2).toString();
      
      // Add particle to container
      particles.appendChild(particle);
      
      // Animate particle
      gsap.to(particle, {
        y: -100 - Math.random() * 100,
        x: Math.sin(Math.random() * 10) * 30,
        opacity: 0,
        duration: duration,
        delay: delay,
        ease: 'power1.out',
        repeat: -1,
        repeatDelay: 0,
        repeatRefresh: true
      });
    }
    
    // Add mouse interaction for button
    if (buttonRef.current) {
      const button = buttonRef.current;
      
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
      };
      
      const handleMouseLeave = () => {
        gsap.to(button, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'elastic.out(1, 0.3)'
        });
      };
      
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className="relative py-20 md:py-32 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-gunmetal-950 via-gunmetal-900 to-gunmetal-950" />
      
      {/* Animated background particles */}
      <div 
        ref={particlesRef}
        className="absolute inset-0 overflow-hidden" 
      />
      
      {/* Content */}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-5xl font-bold mb-6"
        >
          <span className="gradient-text">Ready to Transform Your Trading?</span>
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto"
        >
          Join thousands of traders who are already using AI to achieve their financial goals.
        </motion.p>
        
        <motion.button
          ref={buttonRef}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          whileHover={{ 
            scale: 1.05, 
            boxShadow: "0 0 40px rgba(255,105,180,0.5)" 
          }}
          whileTap={{ scale: 0.95 }}
          onClick={onSignUp}
          className="group flex items-center gap-3 px-8 py-5 bg-neon-magenta text-white rounded-xl hover:bg-[#FF69B4] transition-all duration-300 shadow-[0_0_30px_rgba(255,20,147,0.4)] mx-auto text-xl font-medium"
        >
          <Brain className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <span>Start Your AI Trading Journey</span>
        </motion.button>
      </div>
    </div>
  );
};

export default CallToAction;
