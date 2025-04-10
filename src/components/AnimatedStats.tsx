import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface StatProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
}

const Stat: React.FC<StatProps> = ({ 
  value, 
  label, 
  prefix = '', 
  suffix = '', 
  duration = 2.5,
  delay = 0
}) => {
  const counterRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  
  useEffect(() => {
    if (!counterRef.current) return;
    
    const counter = counterRef.current;
    
    // Create scroll trigger for counter animation
    const trigger = ScrollTrigger.create({
      trigger: counter,
      start: 'top 80%',
      onEnter: () => {
        // Animate the counter
        let startValue = 0;
        let startTime = 0;
        
        const updateCounter = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
          const currentValue = Math.floor(progress * value);
          
          if (counterRef.current) {
            counterRef.current.textContent = `${prefix}${currentValue.toLocaleString()}${suffix}`;
          }
          
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          }
        };
        
        requestAnimationFrame(updateCounter);
        
        // Start the particle animation
        controls.start({
          opacity: 1,
          scale: 1,
          transition: { duration: 0.5, delay }
        });
      },
      once: true
    });
    
    return () => {
      trigger.kill();
    };
  }, [value, prefix, suffix, duration, delay, controls]);
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={controls}
      className="flex flex-col items-center"
    >
      <div 
        ref={counterRef}
        className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2"
      >
        {prefix}0{suffix}
      </div>
      <div className="text-lg text-gray-300">{label}</div>
    </motion.div>
  );
};

export const AnimatedStats: React.FC = () => {
  return (
    <div className="relative py-16 md:py-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-gunmetal-950 via-gunmetal-900 to-gunmetal-950 opacity-90" />
      
      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold text-center mb-16"
        >
          <span className="gradient-text">Powered by Numbers</span>
        </motion.h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          <Stat value={10000} label="Active Traders" prefix="+" delay={0} />
          <Stat value={5000000} label="Trades Executed" delay={0.2} />
          <Stat value={42} label="Average ROI" suffix="%" delay={0.4} />
          <Stat value={24} label="Hours of AI Trading" suffix="/7" delay={0.6} />
        </div>
      </div>
    </div>
  );
};

export default AnimatedStats;
