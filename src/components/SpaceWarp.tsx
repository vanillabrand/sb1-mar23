import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface SpaceWarpProps {
  className?: string;
}

export const SpaceWarp: React.FC<SpaceWarpProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  
  interface Star {
    x: number;
    y: number;
    z: number;
    px: number;
    py: number;
    size: number;
    color: string;
  }
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX - canvas.width / 2,
        y: e.clientY - canvas.height / 2
      };
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    // Create stars
    const createStars = () => {
      const stars: Star[] = [];
      const colors = [
        'rgba(255, 255, 255, 0.8)',
        'rgba(45, 212, 191, 0.8)',
        'rgba(255, 20, 147, 0.8)',
        'rgba(250, 204, 21, 0.8)'
      ];
      
      for (let i = 0; i < 400; i++) {
        const z = Math.random() * 1000 + 1;
        const star = {
          x: Math.random() * canvas.width * 2 - canvas.width,
          y: Math.random() * canvas.height * 2 - canvas.height,
          z,
          px: 0,
          py: 0,
          size: Math.random() * 1.5 + 0.5,
          color: colors[Math.floor(Math.random() * colors.length)]
        };
        
        // Calculate projected position
        star.px = (star.x / star.z) * 500 + canvas.width / 2;
        star.py = (star.y / star.z) * 500 + canvas.height / 2;
        
        stars.push(star);
      }
      
      return stars;
    };
    
    starsRef.current = createStars();
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Center of the canvas
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Mouse influence (subtle)
      const mouseX = mouseRef.current.x * 0.05;
      const mouseY = mouseRef.current.y * 0.05;
      
      // Update and draw stars
      starsRef.current.forEach(star => {
        // Move stars closer (z decreases)
        star.z -= 2;
        
        // If star is too close, reset it
        if (star.z <= 0) {
          star.z = 1000;
          star.x = Math.random() * canvas.width * 2 - canvas.width;
          star.y = Math.random() * canvas.height * 2 - canvas.height;
        }
        
        // Calculate projected position with mouse influence
        star.px = ((star.x + mouseX) / star.z) * 500 + centerX;
        star.py = ((star.y + mouseY) / star.z) * 500 + centerY;
        
        // Calculate size based on distance
        const size = star.size * (1000 / star.z);
        
        // Calculate opacity based on distance
        const opacity = Math.min(1, (1000 - star.z) / 1000);
        
        // Draw star
        ctx.beginPath();
        ctx.arc(star.px, star.py, size, 0, Math.PI * 2);
        
        // Create gradient for star
        const gradient = ctx.createRadialGradient(
          star.px, star.py, 0,
          star.px, star.py, size
        );
        gradient.addColorStop(0, star.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.globalAlpha = opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw trail (only for closer stars)
        if (star.z < 500) {
          const trailLength = (1 - star.z / 500) * 20; // Longer trail for closer stars
          
          // Calculate previous position
          const prevX = ((star.x + mouseX) / (star.z + 2)) * 500 + centerX;
          const prevY = ((star.y + mouseY) / (star.z + 2)) * 500 + centerY;
          
          // Draw trail
          ctx.beginPath();
          ctx.moveTo(star.px, star.py);
          ctx.lineTo(prevX, prevY);
          ctx.strokeStyle = star.color.replace('0.8', `${opacity * 0.5}`);
          ctx.lineWidth = size * 0.8;
          ctx.stroke();
        }
      });
      
      frameRef.current = requestAnimationFrame(animate);
    };
    
    frameRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default SpaceWarp;
