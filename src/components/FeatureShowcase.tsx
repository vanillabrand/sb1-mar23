import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, Draggable);
}

interface Feature {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const features: Feature[] = [
  {
    title: "AI Strategy Creation",
    description: "Tell the AI what you want to achieve, and it will create a custom trading strategy for you.",
    icon: "🧠",
    color: "from-neon-magenta/20 to-transparent"
  },
  {
    title: "Automated Trading",
    description: "Let the AI execute trades for you 24/7, based on your strategy parameters.",
    icon: "⚙️",
    color: "from-neon-cyan/20 to-transparent"
  },
  {
    title: "Real-time Monitoring",
    description: "Track your strategy's performance in real-time with detailed analytics.",
    icon: "📊",
    color: "from-neon-yellow/20 to-transparent"
  },
  {
    title: "Risk Management",
    description: "Advanced risk management tools to protect your investments.",
    icon: "🛡️",
    color: "from-neon-green/20 to-transparent"
  },
  {
    title: "Portfolio Optimization",
    description: "AI-powered suggestions to optimize your trading portfolio for maximum returns.",
    icon: "📈",
    color: "from-neon-purple/20 to-transparent"
  }
];

export const FeatureShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState(0);
  
  useEffect(() => {
    if (!containerRef.current || !trackRef.current) return;
    
    const container = containerRef.current;
    const track = trackRef.current;
    const panels = track.querySelectorAll('.feature-panel');
    
    // Set up horizontal scroll with GSAP
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        pin: true,
        start: "top top",
        end: () => `+=${container.offsetWidth * 1.5}`,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          // Update active feature based on scroll progress
          const newIndex = Math.min(
            Math.floor(self.progress * features.length),
            features.length - 1
          );
          setActiveFeature(newIndex);
        }
      }
    });
    
    // Animate panels
    tl.to(track, {
      x: () => -(track.offsetWidth - container.offsetWidth),
      ease: "none"
    });
    
    // Add depth effect to panels
    panels.forEach((panel, i) => {
      gsap.set(panel, { 
        z: i * 10,
        rotationY: i * 2,
        opacity: i === 0 ? 1 : 0.7
      });
      
      tl.to(panel, {
        opacity: i === panels.length - 1 ? 1 : 0.7,
        rotationY: 0,
        z: 0,
        ease: "power1.inOut"
      }, i / (panels.length - 1));
    });
    
    return () => {
      if (tl.scrollTrigger) {
        tl.scrollTrigger.kill();
      }
    };
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className="relative h-screen overflow-hidden bg-gunmetal-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(45,212,191,0.1),transparent_70%)]" />
      
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-3xl md:text-4xl font-bold text-center pt-16 mb-8 relative z-10"
      >
        <span className="gradient-text">Powerful Features</span>
      </motion.h2>
      
      <div className="relative h-full overflow-hidden">
        <div 
          ref={trackRef}
          className="absolute top-0 left-0 h-full flex items-center"
          style={{ width: `${features.length * 100}vw` }}
        >
          {features.map((feature, index) => (
            <div 
              key={index}
              className="feature-panel w-screen h-full flex items-center justify-center px-4"
            >
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={`relative bg-gunmetal-800/50 backdrop-blur-md rounded-2xl p-8 max-w-2xl border border-gunmetal-700/50 shadow-xl overflow-hidden`}
              >
                <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br ${feature.color} opacity-30`} />
                
                <div className="relative z-10">
                  <div className="text-6xl mb-6">{feature.icon}</div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">{feature.title}</h3>
                  <p className="text-lg text-gray-300">{feature.description}</p>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Feature navigation dots */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
        {features.map((_, index) => (
          <div 
            key={index}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === activeFeature 
                ? 'bg-neon-magenta scale-125' 
                : 'bg-gray-500 scale-100'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default FeatureShowcase;
