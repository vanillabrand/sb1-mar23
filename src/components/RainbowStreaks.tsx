import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface RainbowStreaksProps {
  className?: string;
}

export const RainbowStreaks: React.FC<RainbowStreaksProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streaksRef = useRef<Streak[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  
  interface Streak {
    x: number;
    y: number;
    length: number;
    width: number;
    speed: number;
    angle: number;
    hue: number;
    opacity: number;
    decay: number;
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
        x: e.clientX,
        y: e.clientY
      };
      
      // Create new streaks occasionally on mouse move
      if (Math.random() > 0.85) {
        createStreak(e.clientX, e.clientY);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    // Create a streak
    const createStreak = (x: number, y: number) => {
      const streak = {
        x,
        y,
        length: Math.random() * 200 + 100,
        width: Math.random() * 3 + 1,
        speed: Math.random() * 3 + 1,
        angle: Math.random() * Math.PI * 2,
        hue: Math.random() * 360,
        opacity: Math.random() * 0.5 + 0.2,
        decay: Math.random() * 0.01 + 0.005
      };
      
      streaksRef.current.push(streak);
      
      // Limit the number of streaks
      if (streaksRef.current.length > 20) {
        streaksRef.current.shift();
      }
    };
    
    // Create initial streaks
    for (let i = 0; i < 10; i++) {
      createStreak(
        Math.random() * canvas.width,
        Math.random() * canvas.height
      );
    }
    
    // Animation loop
    const animate = () => {
      // Apply a semi-transparent clear to create trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw streaks
      streaksRef.current.forEach((streak, index) => {
        // Move streak
        streak.x += Math.cos(streak.angle) * streak.speed;
        streak.y += Math.sin(streak.angle) * streak.speed;
        
        // Fade streak
        streak.opacity -= streak.decay;
        
        // Remove faded streaks
        if (streak.opacity <= 0) {
          streaksRef.current.splice(index, 1);
          return;
        }
        
        // Draw streak
        ctx.beginPath();
        
        // Calculate end point
        const endX = streak.x - Math.cos(streak.angle) * streak.length;
        const endY = streak.y - Math.sin(streak.angle) * streak.length;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(
          streak.x, streak.y, endX, endY
        );
        
        // Add rainbow colors
        gradient.addColorStop(0, `hsla(${streak.hue}, 100%, 70%, ${streak.opacity})`);
        gradient.addColorStop(0.5, `hsla(${(streak.hue + 40) % 360}, 100%, 60%, ${streak.opacity * 0.8})`);
        gradient.addColorStop(1, `hsla(${(streak.hue + 80) % 360}, 100%, 50%, 0)`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = streak.width;
        ctx.lineCap = 'round';
        
        ctx.moveTo(streak.x, streak.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Slightly change angle for organic movement
        streak.angle += (Math.random() - 0.5) * 0.1;
        
        // Create new streak occasionally
        if (Math.random() > 0.99) {
          createStreak(
            Math.random() * canvas.width,
            Math.random() * canvas.height
          );
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

export default RainbowStreaks;
