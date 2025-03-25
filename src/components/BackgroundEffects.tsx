import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export function BackgroundEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticle = (x: number, y: number): Particle => ({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: 1 + Math.random() * 2,
      color: [
        'rgba(45, 212, 191, 0.3)',  // neon-turquoise
        'rgba(251, 146, 60, 0.3)',  // neon-orange
        'rgba(236, 72, 153, 0.3)'   // neon-pink
      ][Math.floor(Math.random() * 3)],
      alpha: 0.1 + Math.random() * 0.3
    });

    const initParticles = () => {
      const numParticles = Math.floor((canvas.width * canvas.height) / 20000);
      particlesRef.current = Array.from({ length: numParticles }, () => 
        createParticle(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        )
      );
    };

    const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = particle.color.replace('0.3', particle.alpha.toString());
      ctx.fill();
    };

    const updateParticle = (particle: Particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Wrap around edges
      if (particle.x < 0) particle.x = canvas.width;
      if (particle.x > canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = canvas.height;
      if (particle.y > canvas.height) particle.y = 0;

      // Pulsing effect
      particle.alpha = 0.1 + Math.abs(Math.sin(Date.now() * 0.001) * 0.3);
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(18, 18, 21, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(particle => {
        updateParticle(particle);
        drawParticle(ctx, particle);
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', () => {
      resizeCanvas();
      initParticles();
    });
    
    resizeCanvas();
    initParticles();
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}