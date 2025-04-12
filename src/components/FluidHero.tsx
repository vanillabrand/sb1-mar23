import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, Star } from 'lucide-react';
import { FluidButton } from './FluidButton';

interface FluidHeroProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
}

export const FluidHero: React.FC<FluidHeroProps> = ({ onGetStarted, onLearnMore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const controls = useAnimation();

  // Initialize animations
  useEffect(() => {
    if (!containerRef.current || !headlineRef.current) return;

    const container = containerRef.current;
    const headline = headlineRef.current;

    // Create floating effect for headline
    gsap.to(headline, {
      y: '10px',
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    // Create parallax effect on mouse move
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;

      // Move headline slightly based on mouse
      gsap.to(headline, {
        x: x * 20,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: 'auto'
      });

      // Move other elements with different intensities
      const layers = container.querySelectorAll('.parallax-layer');
      layers.forEach((layer) => {
        const depth = parseFloat((layer as HTMLElement).dataset.depth || '1');
        gsap.to(layer, {
          x: x * 30 * depth,
          y: y * 20 * depth,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });
    };

    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Create fluid particles
  useEffect(() => {
    const particlesContainer = document.querySelector('.hero-particles');
    if (!particlesContainer) return;

    // Create particles
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');

      // Randomize particle properties
      const size = Math.random() * 6 + 2;
      const colorClass = Math.random() > 0.5 ? 'bg-neon-magenta' : 'bg-neon-cyan';

      particle.className = `absolute rounded-full ${colorClass} opacity-0`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;

      particlesContainer.appendChild(particle);

      // Animate particle
      gsap.to(particle, {
        y: -200 - Math.random() * 200,
        x: (Math.random() - 0.5) * 100,
        opacity: 0.3,
        duration: 10 + Math.random() * 20,
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
      className="relative min-h-[80vh] flex items-center overflow-hidden"
    >
      {/* Particles */}
      <div className="hero-particles absolute inset-0 pointer-events-none" />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="mb-6"
          >
            <h1
              ref={headlineRef}
              className="text-4xl md:text-6xl lg:text-7xl font-medium leading-tight"
            >
              <span className="relative inline-block">
                <span className="relative z-10">Elevate your</span>
                <div className="absolute -inset-1 bg-gradient-to-r from-neon-magenta/20 to-neon-cyan/20 blur-xl rounded-full -z-10" />
              </span>
              <br />
              <span className="bg-gradient-to-r from-neon-magenta to-neon-cyan bg-clip-text text-transparent">
                crypto trading
              </span>
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">with AI precision</span>
                <div className="absolute -inset-1 bg-gradient-to-r from-neon-cyan/20 to-neon-magenta/20 blur-xl rounded-full -z-10" />
              </span>
            </h1>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-xl md:text-2xl text-gray-300 max-w-3xl mb-10 parallax-layer"
            data-depth="0.5"
          >
            Let AI handle the complexity while you focus on what matters - your strategy
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col sm:flex-row gap-5 parallax-layer"
            data-depth="1.2"
          >
            <FluidButton
              primary
              onClick={onGetStarted}
              icon={<Brain className="w-5 h-5" />}
            >
              Start Trading with AI
            </FluidButton>

            <FluidButton
              onClick={onLearnMore}
              icon={<Star className="w-5 h-5 text-neon-yellow" />}
            >
              How It Works
            </FluidButton>
          </motion.div>

          {/* Floating elements */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-neon-magenta/5 blur-3xl parallax-layer" data-depth="2" />
          <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-neon-cyan/5 blur-3xl parallax-layer" data-depth="1.5" />
          <div className="absolute top-1/2 right-1/3 w-24 h-24 rounded-full bg-neon-yellow/5 blur-3xl parallax-layer" data-depth="2.5" />
        </div>
      </div>
    </div>
  );
};

export default FluidHero;
