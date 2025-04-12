import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, BarChart3, TrendingUp } from 'lucide-react';

interface FeaturePanelProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}

const FeaturePanel: React.FC<FeaturePanelProps> = ({ title, description, icon, index }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!panelRef.current) return;
    
    // Add subtle hover effect
    const panel = panelRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = panel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate percentage position
      const xPercent = x / rect.width;
      const yPercent = y / rect.height;
      
      // Calculate rotation (subtle)
      const rotateX = (0.5 - yPercent) * 4;
      const rotateY = (xPercent - 0.5) * 4;
      
      // Apply transform
      gsap.to(panel, {
        rotateX,
        rotateY,
        transformPerspective: 1000,
        duration: 0.4,
        ease: 'power2.out'
      });
      
      // Highlight effect
      gsap.to(panel.querySelector('.highlight'), {
        opacity: 0.15,
        x: `${xPercent * 100}%`,
        y: `${yPercent * 100}%`,
        duration: 0.4,
        ease: 'power2.out'
      });
    };
    
    const handleMouseLeave = () => {
      gsap.to(panel, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.3)'
      });
      
      gsap.to(panel.querySelector('.highlight'), {
        opacity: 0,
        duration: 0.7
      });
    };
    
    panel.addEventListener('mousemove', handleMouseMove);
    panel.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      panel.removeEventListener('mousemove', handleMouseMove);
      panel.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        transition: { 
          duration: 0.5, 
          delay: 0.2 + index * 0.1,
          ease: [0.25, 0.1, 0.25, 1] 
        }
      }}
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/[0.02] border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Glass highlight effect */}
      <div className="highlight absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white to-transparent opacity-0 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center mb-4">
          <div className="p-3 rounded-lg bg-neon-magenta/10 text-neon-magenta mr-4">
            {icon}
          </div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        <p className="text-gray-300">{description}</p>
      </div>
    </motion.div>
  );
};

export const FeaturePanels: React.FC = () => {
  const features = [
    {
      title: "AI Strategy Creation",
      description: "Tell the AI what you want to achieve, and it will create a custom trading strategy for you.",
      icon: <Brain className="w-6 h-6" />
    },
    {
      title: "Real-time Monitoring",
      description: "Track your strategy's performance in real-time with detailed analytics.",
      icon: <BarChart3 className="w-6 h-6" />
    },
    {
      title: "Automated Trading",
      description: "Let the AI execute trades for you 24/7, based on your strategy parameters.",
      icon: <TrendingUp className="w-6 h-6" />
    }
  ];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <FeaturePanel
            key={index}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default FeaturePanels;
