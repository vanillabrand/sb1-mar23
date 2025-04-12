import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';

interface FluidButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const FluidButton: React.FC<FluidButtonProps> = ({ 
  children, 
  onClick, 
  primary = false,
  className = '',
  icon
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  useEffect(() => {
    if (!buttonRef.current || !canvasRef.current) return;
    
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const updateCanvasSize = () => {
      const rect = button.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // Particle system
    const particles: Particle[] = [];
    const particleCount = 20;
    
    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      life: number;
      maxLife: number;
      color: string;
    }
    
    // Create particles
    const createParticles = (x: number, y: number) => {
      const colors = primary 
        ? ['rgba(255, 20, 147, 0.8)', 'rgba(255, 105, 180, 0.8)', 'rgba(255, 182, 193, 0.8)']
        : ['rgba(255, 255, 255, 0.8)', 'rgba(200, 200, 200, 0.8)', 'rgba(150, 150, 150, 0.8)'];
      
      for (let i = 0; i < 5; i++) {
        particles.push({
          x,
          y,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 3,
          speedY: (Math.random() - 0.5) * 3,
          life: 0,
          maxLife: Math.random() * 20 + 10,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
        
        // Remove oldest particles if we have too many
        if (particles.length > particleCount) {
          particles.shift();
        }
      }
    };
    
    // Animate particles
    const animateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((particle, index) => {
        particle.life++;
        
        if (particle.life >= particle.maxLife) {
          particles.splice(index, 1);
          return;
        }
        
        const opacity = 1 - (particle.life / particle.maxLife);
        const color = particle.color.replace('0.8', opacity.toString());
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        particle.x += particle.speedX;
        particle.y += particle.speedY;
      });
      
      animationRef.current = requestAnimationFrame(animateParticles);
    };
    
    // Start animation
    animateParticles();
    
    // Mouse interaction
    let isHovering = false;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isHovering) return;
      
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      createParticles(x, y);
      
      // Magnetic effect
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const distanceX = x - centerX;
      const distanceY = y - centerY;
      
      gsap.to(button, {
        x: distanceX * 0.1,
        y: distanceY * 0.1,
        duration: 0.3,
        ease: 'power2.out'
      });
    };
    
    const handleMouseEnter = () => {
      isHovering = true;
      
      // Create initial particles
      for (let i = 0; i < 10; i++) {
        createParticles(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        );
      }
      
      // Scale effect
      gsap.to(button, {
        scale: 1.03,
        duration: 0.3,
        ease: 'power2.out'
      });
      
      // Glow effect
      if (primary) {
        gsap.to(button, {
          boxShadow: '0 0 25px rgba(255, 20, 147, 0.6)',
          duration: 0.3
        });
      } else {
        gsap.to(button, {
          boxShadow: '0 0 15px rgba(255, 255, 255, 0.2)',
          duration: 0.3
        });
      }
    };
    
    const handleMouseLeave = () => {
      isHovering = false;
      
      gsap.to(button, {
        x: 0,
        y: 0,
        scale: 1,
        boxShadow: primary 
          ? '0 0 15px rgba(255, 20, 147, 0.3)' 
          : '0 0 0 rgba(255, 255, 255, 0)',
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)'
      });
    };
    
    button.addEventListener('mouseenter', handleMouseEnter);
    button.addEventListener('mouseleave', handleMouseLeave);
    button.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', updateCanvasSize);
      button.removeEventListener('mouseenter', handleMouseEnter);
      button.removeEventListener('mouseleave', handleMouseLeave);
      button.removeEventListener('mousemove', handleMouseMove);
    };
  }, [primary]);
  
  return (
    <motion.button
      ref={buttonRef}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`relative overflow-hidden group ${
        primary 
          ? 'bg-gradient-to-r from-neon-magenta to-neon-raspberry text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]' 
          : 'bg-white/[0.03] text-white border border-white/10'
      } rounded-full px-6 py-3 ${className}`}
      style={{ transformOrigin: 'center' }}
    >
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon && <span className="group-hover:rotate-12 transition-transform duration-300">{icon}</span>}
        {children}
      </span>
    </motion.button>
  );
};

export default FluidButton;
