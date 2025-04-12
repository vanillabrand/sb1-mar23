import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, BarChart3, TrendingUp } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon, index }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    
    // Subtle hover effect
    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate percentage position
      const xPercent = x / rect.width;
      const yPercent = y / rect.height;
      
      // Calculate rotation (very subtle)
      const rotateX = (0.5 - yPercent) * 2;
      const rotateY = (xPercent - 0.5) * 2;
      
      // Apply transform
      gsap.to(card, {
        rotateX,
        rotateY,
        transformPerspective: 1000,
        duration: 0.4,
        ease: 'power2.out'
      });
      
      // Highlight effect
      const highlight = card.querySelector('.card-highlight') as HTMLElement;
      if (highlight) {
        gsap.to(highlight, {
          opacity: 0.1,
          x: `${x}px`,
          y: `${y}px`,
          duration: 0.4,
          ease: 'power2.out'
        });
      }
    };
    
    const handleMouseLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.3)'
      });
      
      const highlight = card.querySelector('.card-highlight') as HTMLElement;
      if (highlight) {
        gsap.to(highlight, {
          opacity: 0,
          duration: 0.7
        });
      }
    };
    
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        transition: { 
          duration: 0.5, 
          delay: 0.3 + index * 0.1,
          ease: [0.25, 0.1, 0.25, 1] 
        }
      }}
      className="relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-6 h-full"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Card highlight effect */}
      <div className="card-highlight absolute w-32 h-32 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none blur-xl" />
      
      {/* Glass reflections */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        <div className="p-3 rounded-lg bg-white/[0.03] text-neon-magenta w-fit mb-4">
          {icon}
        </div>
        
        <h3 className="text-xl font-medium text-white mb-2">{title}</h3>
        
        <p className="text-gray-300 text-sm leading-relaxed flex-grow">{description}</p>
        
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center text-sm text-neon-cyan">
            <span>Learn more</span>
            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ElegantFeatureCards: React.FC = () => {
  const features = [
    {
      title: "AI Strategy Creation",
      description: "Tell our AI what you want to achieve, and it will create a custom trading strategy tailored to your goals and risk tolerance.",
      icon: <Brain className="w-5 h-5" />
    },
    {
      title: "Real-time Monitoring",
      description: "Track your strategy's performance with detailed analytics and real-time updates on your portfolio's growth.",
      icon: <BarChart3 className="w-5 h-5" />
    },
    {
      title: "Automated Trading",
      description: "Let the AI execute trades for you 24/7, based on your strategy parameters and market conditions.",
      icon: <TrendingUp className="w-5 h-5" />
    }
  ];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <FeatureCard
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

export default ElegantFeatureCards;
