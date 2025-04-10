import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';

interface CardProps {
  title: string;
  icon: string;
  description: string;
  index: number;
}

const Card: React.FC<CardProps> = ({ title, icon, description, index }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    
    // Floating animation
    gsap.to(card, {
      y: '10px',
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
      delay: index * 0.3
    });
  }, [index]);
  
  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 + index * 0.2 }}
      whileHover={{ 
        y: -10, 
        boxShadow: "0 20px 40px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.1) inset",
        transition: { duration: 0.3 }
      }}
      className="bg-gunmetal-800/50 backdrop-blur-md rounded-xl p-6 border border-gunmetal-700/50 hover:border-gunmetal-600/50 shadow-lg"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-300">{description}</p>
    </motion.div>
  );
};

export const FloatingCards: React.FC = () => {
  const cards = [
    { 
      title: "Create Strategy", 
      icon: "🧠", 
      description: "Design your trading strategy with AI assistance" 
    },
    { 
      title: "Monitor Performance", 
      icon: "📊", 
      description: "Track your strategy's performance in real-time" 
    },
    { 
      title: "Optimize Returns", 
      icon: "💰", 
      description: "Maximize profits with AI-powered optimizations" 
    }
  ];
  
  return (
    <div className="relative max-w-7xl mx-auto px-4 mb-24">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <Card
            key={index}
            title={card.title}
            icon={card.icon}
            description={card.description}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default FloatingCards;
