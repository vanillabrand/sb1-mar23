import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, BarChart3, TrendingUp, ChevronRight, ChevronLeft } from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

const features: Feature[] = [
  {
    title: "AI Strategy Creation",
    description: "Tell our AI what you want to achieve, and it will create a custom trading strategy tailored to your goals and risk tolerance.",
    icon: <Brain className="w-6 h-6" />,
    color: "neon-magenta",
    gradient: "from-neon-magenta/20 to-transparent"
  },
  {
    title: "Real-time Monitoring",
    description: "Track your strategy's performance with detailed analytics and real-time updates on your portfolio's growth.",
    icon: <BarChart3 className="w-6 h-6" />,
    color: "neon-cyan",
    gradient: "from-neon-cyan/20 to-transparent"
  },
  {
    title: "Automated Trading",
    description: "Let the AI execute trades for you 24/7, based on your strategy parameters and market conditions.",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "neon-yellow",
    gradient: "from-neon-yellow/20 to-transparent"
  }
];

export const ImmersiveFeatures: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const controls = useAnimation();
  
  // Handle feature change
  const changeFeature = (index: number) => {
    if (index < 0) index = features.length - 1;
    if (index >= features.length) index = 0;
    
    setActiveFeature(index);
  };
  
  // Initialize 3D perspective effect
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      
      // Apply subtle rotation based on mouse position
      gsap.to(container, {
        rotationY: x * 5,
        rotationX: -y * 5,
        transformPerspective: 1000,
        duration: 0.5,
        ease: 'power2.out'
      });
      
      // Move active feature slightly based on mouse
      const activeFeature = featureRefs.current[activeFeature];
      if (activeFeature) {
        gsap.to(activeFeature, {
          x: x * 15,
          y: y * 15,
          duration: 0.5,
          ease: 'power2.out'
        });
      }
    };
    
    const handleMouseLeave = () => {
      gsap.to(container, {
        rotationY: 0,
        rotationX: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.3)'
      });
      
      const activeFeature = featureRefs.current[activeFeature];
      if (activeFeature) {
        gsap.to(activeFeature, {
          x: 0,
          y: 0,
          duration: 0.7,
          ease: 'elastic.out(1, 0.3)'
        });
      }
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [activeFeature]);
  
  // Create floating particles
  useEffect(() => {
    featureRefs.current.forEach((featureRef, index) => {
      if (!featureRef) return;
      
      const particlesContainer = featureRef.querySelector('.particles-container');
      if (!particlesContainer) return;
      
      // Clear existing particles
      while (particlesContainer.firstChild) {
        particlesContainer.removeChild(particlesContainer.firstChild);
      }
      
      // Only create particles for active feature
      if (index !== activeFeature) return;
      
      // Create particles
      const feature = features[index];
      const colorClass = `text-${feature.color}`;
      
      for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = `absolute rounded-full ${colorClass} opacity-0`;
        
        // Randomize particle properties
        const size = Math.random() * 4 + 2;
        
        // Set particle styles
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        particlesContainer.appendChild(particle);
        
        // Animate particle
        gsap.to(particle, {
          y: -100 - Math.random() * 100,
          x: (Math.random() - 0.5) * 50,
          opacity: 0.7,
          duration: 5 + Math.random() * 10,
          delay: Math.random() * 5,
          repeat: -1,
          repeatDelay: Math.random() * 5,
          ease: 'power1.out'
        });
      }
    });
  }, [activeFeature]);
  
  return (
    <div className="py-16 relative overflow-hidden">
      <div 
        ref={containerRef}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-medium text-white mb-4">
            Powerful AI Trading Features
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Our platform combines cutting-edge AI with intuitive design to make trading accessible to everyone.
          </p>
        </motion.div>
        
        <div className="relative h-[400px] md:h-[500px]">
          <AnimatePresence mode="wait">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                ref={el => featureRefs.current[index] = el}
                initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                animate={index === activeFeature ? { 
                  opacity: 1, 
                  scale: 1,
                  rotateY: 0,
                  zIndex: 10
                } : { 
                  opacity: 0, 
                  scale: 0.9,
                  rotateY: 10,
                  zIndex: 1
                }}
                exit={{ opacity: 0, scale: 0.9, rotateY: 10 }}
                transition={{ 
                  duration: 0.7, 
                  ease: [0.25, 0.1, 0.25, 1]
                }}
                className={`absolute inset-0 ${index === activeFeature ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="relative h-full flex flex-col md:flex-row items-center gap-8 p-6">
                  {/* Particles container */}
                  <div className="particles-container absolute inset-0 pointer-events-none" />
                  
                  {/* Feature icon */}
                  <div className={`relative flex-shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-${feature.color} z-10`}>
                    <div className="text-3xl md:text-4xl">
                      {feature.icon}
                    </div>
                    
                    {/* Glow effect */}
                    <div className={`absolute inset-0 rounded-full bg-${feature.color} opacity-20 blur-xl`} />
                  </div>
                  
                  {/* Feature content */}
                  <div className="flex-1 text-center md:text-left z-10">
                    <h3 className={`text-2xl font-medium mb-4 text-${feature.color}`}>
                      {feature.title}
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed mb-6">
                      {feature.description}
                    </p>
                    
                    <motion.button
                      whileHover={{ x: 5 }}
                      className={`inline-flex items-center text-${feature.color} font-medium`}
                    >
                      Learn more
                      <ChevronRight className="ml-1 w-5 h-5" />
                    </motion.button>
                  </div>
                  
                  {/* Background card with glass effect */}
                  <div className="absolute inset-0 -z-10 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-sm border border-white/10" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-10`} />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {/* Navigation buttons */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
            <motion.button
              whileHover={{ scale: 1.1, x: 3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => changeFeature(activeFeature - 1)}
              className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
          </div>
          
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
            <motion.button
              whileHover={{ scale: 1.1, x: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => changeFeature(activeFeature + 1)}
              className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>
          
          {/* Indicator dots */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => changeFeature(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === activeFeature 
                    ? `w-6 bg-${features[index].color}` 
                    : 'bg-white/30'
                }`}
                aria-label={`Go to feature ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImmersiveFeatures;
