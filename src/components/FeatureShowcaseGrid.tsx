import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, BarChart3, TrendingUp, Zap, Shield, Coins } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const features: Feature[] = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: "AI Strategy Creation",
    description: "Tell our AI what you want to achieve, and it will create a custom trading strategy tailored to your goals.",
    color: "from-pink-500 to-purple-500"
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Real-time Analytics",
    description: "Track your strategy's performance with detailed analytics and real-time updates on your portfolio.",
    color: "from-cyan-500 to-blue-500"
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Automated Trading",
    description: "Let the AI execute trades for you 24/7, based on your strategy parameters and market conditions.",
    color: "from-yellow-500 to-orange-500"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Lightning Fast Execution",
    description: "Our platform executes trades in milliseconds, ensuring you never miss an opportunity.",
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Risk Management",
    description: "Advanced risk management tools to protect your investments and optimize your returns.",
    color: "from-indigo-500 to-violet-500"
  },
  {
    icon: <Coins className="w-6 h-6" />,
    title: "Multi-Exchange Support",
    description: "Connect to multiple exchanges and manage all your trading from a single platform.",
    color: "from-rose-500 to-red-500"
  }
];

export const FeatureShowcaseGrid: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  
  useEffect(() => {
    controls.start(i => ({
      opacity: 1,
      y: 0,
      transition: { 
        duration: 0.5,
        delay: i * 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }));
  }, [controls]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const cards = containerRef.current.querySelectorAll('.feature-card');
    
    cards.forEach(card => {
      // Create hover effect
      const handleMouseMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate percentage position
        const xPercent = x / rect.width;
        const yPercent = y / rect.height;
        
        // Calculate rotation (subtle)
        const rotateX = (0.5 - yPercent) * 8;
        const rotateY = (xPercent - 0.5) * 8;
        
        gsap.to(card, {
          rotationY: rotateY,
          rotationX: rotateX,
          transformPerspective: 1000,
          ease: 'power2.out',
          duration: 0.3,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          scale: 1.02
        });
        
        // Move icon
        const icon = card.querySelector('.feature-icon');
        if (icon) {
          gsap.to(icon, {
            x: (xPercent - 0.5) * 15,
            y: (yPercent - 0.5) * 15,
            ease: 'power2.out',
            duration: 0.3
          });
        }
        
        // Highlight effect
        const highlight = card.querySelector('.card-highlight');
        if (highlight) {
          gsap.to(highlight, {
            opacity: 0.15,
            x: x,
            y: y,
            ease: 'power2.out',
            duration: 0.3
          });
        }
      };
      
      const handleMouseLeave = () => {
        gsap.to(card, {
          rotationY: 0,
          rotationX: 0,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
          scale: 1,
          ease: 'power2.out',
          duration: 0.5
        });
        
        // Reset icon position
        const icon = card.querySelector('.feature-icon');
        if (icon) {
          gsap.to(icon, {
            x: 0,
            y: 0,
            ease: 'power2.out',
            duration: 0.5
          });
        }
        
        // Reset highlight
        const highlight = card.querySelector('.card-highlight');
        if (highlight) {
          gsap.to(highlight, {
            opacity: 0,
            ease: 'power2.out',
            duration: 0.5
          });
        }
      };
      
      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', handleMouseLeave);
      };
    });
  }, []);
  
  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-medium text-white mb-4">
            Powerful AI Trading Features
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Our platform combines cutting-edge AI with intuitive design to make trading accessible to everyone.
          </p>
        </motion.div>
        
        <div 
          ref={containerRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              custom={index}
              initial={{ opacity: 0, y: 20 }}
              animate={controls}
              className="feature-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] backdrop-blur-sm border border-white/10 shadow-lg p-6 h-full"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Card highlight effect */}
              <div className="card-highlight absolute w-32 h-32 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none blur-xl" />
              
              {/* Gradient border */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-10 pointer-events-none`} />
              
              {/* Content */}
              <div className="relative z-10 flex flex-col h-full">
                <div className="feature-icon flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm mb-4">
                  <div className={`bg-gradient-to-br ${feature.color} bg-clip-text text-transparent`}>
                    {feature.icon}
                  </div>
                </div>
                
                <h3 className="text-xl font-medium text-white mb-2">
                  {feature.title}
                </h3>
                
                <p className="text-gray-300 text-sm leading-relaxed flex-grow">
                  {feature.description}
                </p>
                
                <div className="mt-4 pt-4 border-t border-white/5">
                  <motion.button
                    whileHover={{ x: 5 }}
                    className={`flex items-center text-sm bg-gradient-to-r ${feature.color} bg-clip-text text-transparent font-medium`}
                  >
                    Learn more
                    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeatureShowcaseGrid;
