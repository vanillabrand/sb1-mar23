import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  image: string;
}

const testimonials: Testimonial[] = [
  {
    quote: "GIGAntic has completely transformed my trading. I've seen a 37% increase in my portfolio since I started using it.",
    author: "Alex Johnson",
    role: "Day Trader",
    image: "https://randomuser.me/api/portraits/men/32.jpg"
  },
  {
    quote: "The AI-powered strategies are incredible. I just tell it what I want, and it handles everything else.",
    author: "Sarah Chen",
    role: "Crypto Investor",
    image: "https://randomuser.me/api/portraits/women/44.jpg"
  },
  {
    quote: "As someone new to trading, GIGAntic made it accessible. The AI does all the complex work for me.",
    author: "Michael Rodriguez",
    role: "Passive Investor",
    image: "https://randomuser.me/api/portraits/men/67.jpg"
  },
  {
    quote: "The real-time monitoring and automated trading have given me back hours of my day. Worth every penny.",
    author: "Emma Wilson",
    role: "Portfolio Manager",
    image: "https://randomuser.me/api/portraits/women/29.jpg"
  }
];

export const TestimonialsSection: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  
  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Floating animation for cards
  useEffect(() => {
    if (!containerRef.current) return;
    
    cardsRef.current.forEach((card, index) => {
      if (!card) return;
      
      gsap.to(card, {
        y: '10px',
        rotation: index % 2 === 0 ? 1 : -1,
        duration: 2 + index * 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: index * 0.3
      });
    });
  }, []);
  
  return (
    <div className="relative py-16 md:py-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-gunmetal-900 to-gunmetal-950 opacity-90" />
      
      {/* Particle lines */}
      <div className="absolute inset-0 opacity-20">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white"
            style={{
              height: '1px',
              width: `${Math.random() * 30 + 10}%`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.1,
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        ))}
      </div>
      
      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold text-center mb-16"
        >
          <span className="gradient-text">What Our Users Say</span>
        </motion.h2>
        
        <div 
          ref={containerRef}
          className="relative h-[400px] md:h-[300px] mb-12"
        >
          <AnimatePresence mode="wait">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                ref={el => cardsRef.current[index] = el}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ 
                  opacity: index === currentIndex ? 1 : 0.3,
                  scale: index === currentIndex ? 1 : 0.8,
                  y: 0,
                  zIndex: index === currentIndex ? 10 : 1
                }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ duration: 0.5 }}
                className={`absolute top-0 left-0 right-0 mx-auto max-w-2xl bg-gunmetal-800/50 backdrop-blur-md rounded-xl p-6 border border-gunmetal-700/50 shadow-xl ${
                  index === currentIndex ? 'z-10' : 'z-0'
                }`}
                style={{
                  transform: `translateX(${(index - currentIndex) * 60}px) translateY(${(index - currentIndex) * 20}px)`,
                  pointerEvents: index === currentIndex ? 'auto' : 'none'
                }}
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <div className="flex-shrink-0">
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.author}
                      className="w-16 h-16 rounded-full border-2 border-neon-magenta/50"
                    />
                  </div>
                  <div>
                    <p className="text-gray-300 italic mb-4">"{testimonial.quote}"</p>
                    <div className="flex items-center">
                      <div>
                        <p className="font-bold text-white">{testimonial.author}</p>
                        <p className="text-gray-400 text-sm">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Navigation dots */}
        <div className="flex justify-center space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-neon-magenta scale-125' 
                  : 'bg-gray-500 scale-100'
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestimonialsSection;
