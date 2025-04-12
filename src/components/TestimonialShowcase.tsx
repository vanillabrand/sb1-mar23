import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  content: string;
  image: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    name: "Sarah Johnson",
    role: "Day Trader",
    content: "The AI-powered strategies have completely transformed my trading. I've seen a 32% increase in my portfolio in just three months with much less stress.",
    image: "https://randomuser.me/api/portraits/women/32.jpg",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "Crypto Investor",
    content: "As someone new to crypto trading, this platform has been a game-changer. The AI handles all the complex decisions while I focus on my long-term goals.",
    image: "https://randomuser.me/api/portraits/men/54.jpg",
    rating: 5
  },
  {
    name: "Emma Rodriguez",
    role: "Passive Investor",
    content: "I was skeptical about AI trading at first, but the results speak for themselves. My passive income has doubled, and I barely spend any time managing it.",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    rating: 4
  }
];

export const TestimonialShowcase: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Initialize 3D card effect
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    
    // Create 3D perspective effect
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        
        // Only apply effect to active card
        if (index !== activeIndex) return;
        
        gsap.to(card, {
          rotationY: x * 10,
          rotationX: -y * 10,
          transformPerspective: 1000,
          duration: 0.5,
          ease: 'power2.out'
        });
        
        // Move elements with different intensities
        const layers = card.querySelectorAll('.card-layer');
        layers.forEach((layer) => {
          const depth = parseFloat((layer as HTMLElement).dataset.depth || '1');
          gsap.to(layer, {
            x: x * 25 * depth,
            y: y * 15 * depth,
            duration: 0.5,
            ease: 'power2.out'
          });
        });
      });
    };
    
    const handleMouseLeave = () => {
      cardRefs.current.forEach((card) => {
        if (!card) return;
        
        gsap.to(card, {
          rotationY: 0,
          rotationX: 0,
          duration: 0.7,
          ease: 'elastic.out(1, 0.3)'
        });
        
        const layers = card.querySelectorAll('.card-layer');
        layers.forEach((layer) => {
          gsap.to(layer, {
            x: 0,
            y: 0,
            duration: 0.7,
            ease: 'elastic.out(1, 0.3)'
          });
        });
      });
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [activeIndex]);
  
  // Handle navigation
  const navigate = (direction: number) => {
    let newIndex = activeIndex + direction;
    
    if (newIndex < 0) {
      newIndex = testimonials.length - 1;
    } else if (newIndex >= testimonials.length) {
      newIndex = 0;
    }
    
    setActiveIndex(newIndex);
  };
  
  return (
    <div className="py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-medium text-white mb-4">
            What Our Traders Say
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Join thousands of traders who have transformed their trading experience with our AI-powered platform.
          </p>
        </motion.div>
        
        <div 
          ref={containerRef}
          className="relative h-[400px] md:h-[450px] max-w-4xl mx-auto"
        >
          <AnimatePresence mode="wait">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                ref={el => cardRefs.current[index] = el}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={index === activeIndex ? { 
                  opacity: 1, 
                  scale: 1,
                  y: 0,
                  zIndex: 10
                } : { 
                  opacity: 0, 
                  scale: 0.9,
                  y: 20,
                  zIndex: 1
                }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ 
                  duration: 0.7, 
                  ease: [0.25, 0.1, 0.25, 1]
                }}
                className={`absolute inset-0 ${index === activeIndex ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="h-full flex flex-col p-8 rounded-2xl overflow-hidden">
                  {/* Card background with glass effect */}
                  <div className="absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-sm border border-white/10" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                  
                  {/* Quote icon */}
                  <div className="absolute top-6 right-6 text-white/10 card-layer" data-depth="2">
                    <Quote className="w-16 h-16" />
                  </div>
                  
                  {/* Testimonial content */}
                  <div className="flex flex-col h-full">
                    <div className="mb-6 card-layer" data-depth="0.5">
                      <p className="text-xl text-gray-200 italic leading-relaxed">
                        "{testimonial.content}"
                      </p>
                    </div>
                    
                    <div className="mt-auto flex items-center">
                      <div className="w-14 h-14 rounded-full overflow-hidden mr-4 card-layer" data-depth="1.5">
                        <img 
                          src={testimonial.image} 
                          alt={testimonial.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="card-layer" data-depth="1">
                        <h4 className="text-lg font-medium text-white">
                          {testimonial.name}
                        </h4>
                        <p className="text-gray-400">
                          {testimonial.role}
                        </p>
                      </div>
                      
                      <div className="ml-auto flex card-layer" data-depth="1.2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            className={`w-5 h-5 ${i < testimonial.rating ? 'text-neon-yellow' : 'text-gray-600'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
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
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
          </div>
          
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
            <motion.button
              whileHover={{ scale: 1.1, x: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(1)}
              className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>
          
          {/* Indicator dots */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === activeIndex 
                    ? 'w-6 bg-neon-magenta' 
                    : 'bg-white/30'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialShowcase;
