import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain } from 'lucide-react';
import { FluidButton } from './FluidButton';

interface PerspectiveCTAProps {
  onSignUp: () => void;
}

export const PerspectiveCTA: React.FC<PerspectiveCTAProps> = ({ onSignUp }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;
    
    const container = containerRef.current;
    const content = contentRef.current;
    
    // Create 3D perspective effect
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      
      // Apply subtle rotation based on mouse position
      gsap.to(content, {
        rotationY: x * 5,
        rotationX: -y * 5,
        transformPerspective: 1000,
        duration: 0.5,
        ease: 'power2.out'
      });
      
      // Move elements with different intensities
      const layers = container.querySelectorAll('.perspective-layer');
      layers.forEach((layer) => {
        const depth = parseFloat((layer as HTMLElement).dataset.depth || '1');
        gsap.to(layer, {
          x: x * 20 * depth,
          y: y * 10 * depth,
          duration: 0.5,
          ease: 'power2.out'
        });
      });
    };
    
    const handleMouseLeave = () => {
      gsap.to(content, {
        rotationY: 0,
        rotationX: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.3)'
      });
      
      const layers = container.querySelectorAll('.perspective-layer');
      layers.forEach((layer) => {
        gsap.to(layer, {
          x: 0,
          y: 0,
          duration: 0.7,
          ease: 'elastic.out(1, 0.3)'
        });
      });
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  // Create fluid particles
  useEffect(() => {
    const particlesContainer = document.querySelector('.cta-particles');
    if (!particlesContainer) return;
    
    // Create particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      
      // Randomize particle properties
      const size = Math.random() * 4 + 1;
      const colorClass = Math.random() > 0.5 ? 'bg-neon-magenta' : 'bg-white';
      
      particle.className = `absolute rounded-full ${colorClass} opacity-0`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      
      particlesContainer.appendChild(particle);
      
      // Animate particle
      gsap.to(particle, {
        y: -100 - Math.random() * 100,
        x: (Math.random() - 0.5) * 50,
        opacity: 0.2,
        duration: 5 + Math.random() * 10,
        delay: Math.random() * 5,
        repeat: -1,
        repeatDelay: Math.random() * 5,
        ease: 'power1.out'
      });
    }
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className="py-16 relative overflow-hidden"
    >
      {/* Particles */}
      <div className="cta-particles absolute inset-0 pointer-events-none" />
      
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full bg-neon-magenta/10 blur-3xl perspective-layer" data-depth="2" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-neon-cyan/10 blur-3xl perspective-layer" data-depth="1.5" />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={contentRef}
          className="relative overflow-hidden rounded-2xl p-8 md:p-12"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Glass card background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-sm border border-white/10" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-neon-magenta/5 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-center mb-8 perspective-layer"
              data-depth="0.5"
            >
              <h2 className="text-3xl font-medium text-white mb-4">
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
              className="flex justify-center perspective-layer"
              data-depth="1"
            >
              <FluidButton
                primary
                onClick={onSignUp}
                icon={<Brain className="w-5 h-5" />}
                className="px-8 py-4"
              >
                Start your AI trading journey
              </FluidButton>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerspectiveCTA;
