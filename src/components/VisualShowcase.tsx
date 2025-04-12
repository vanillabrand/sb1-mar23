import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { gsap } from 'gsap';
import { ArrowRight } from 'lucide-react';

export const VisualShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  
  useEffect(() => {
    controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }
    });
  }, [controls]);
  
  useEffect(() => {
    if (!containerRef.current || !imageRef.current) return;
    
    const container = containerRef.current;
    const image = imageRef.current;
    
    // Create parallax effect
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      
      gsap.to(image, {
        rotationY: x * 10,
        rotationX: -y * 10,
        transformPerspective: 1000,
        ease: 'power2.out',
        duration: 0.5
      });
      
      // Move elements with different intensities
      const layers = container.querySelectorAll('.parallax-layer');
      layers.forEach((layer) => {
        const depth = parseFloat((layer as HTMLElement).dataset.depth || '1');
        gsap.to(layer, {
          x: x * 30 * depth,
          y: y * 20 * depth,
          ease: 'power2.out',
          duration: 0.5
        });
      });
    };
    
    const handleMouseLeave = () => {
      gsap.to(image, {
        rotationY: 0,
        rotationX: 0,
        ease: 'power2.out',
        duration: 0.7
      });
      
      const layers = container.querySelectorAll('.parallax-layer');
      layers.forEach((layer) => {
        gsap.to(layer, {
          x: 0,
          y: 0,
          ease: 'power2.out',
          duration: 0.7
        });
      });
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  // Create floating animation for UI elements
  useEffect(() => {
    if (!imageRef.current) return;
    
    const elements = imageRef.current.querySelectorAll('.floating-element');
    
    elements.forEach((element, index) => {
      gsap.to(element, {
        y: `${Math.sin(index) * 10}px`,
        duration: 2 + index * 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: index * 0.2
      });
    });
  }, []);
  
  return (
    <div className="py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={containerRef}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={controls}
            className="parallax-layer"
            data-depth="0.5"
          >
            <h2 className="text-3xl font-medium text-white mb-6">
              Experience the future of trading with our intuitive interface
            </h2>
            
            <p className="text-gray-300 mb-8">
              Our platform combines powerful AI algorithms with a beautiful, easy-to-use interface. Monitor your strategies, track performance, and make data-driven decisions with confidence.
            </p>
            
            <ul className="space-y-4 mb-8">
              {['Real-time dashboard', 'Advanced charting tools', 'Portfolio analytics', 'Strategy backtesting'].map((item, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                  className="flex items-center text-gray-200"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center mr-3">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  {item}
                </motion.li>
              ))}
            </ul>
            
            <motion.button
              whileHover={{ x: 5 }}
              className="flex items-center text-white font-medium bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg px-6 py-3"
            >
              Explore the platform
              <ArrowRight className="ml-2 w-5 h-5" />
            </motion.button>
          </motion.div>
          
          {/* Visual showcase */}
          <motion.div
            ref={imageRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Main dashboard mockup */}
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-white/10 parallax-layer" data-depth="1">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              
              {/* Dashboard header */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 h-6 rounded-md bg-white/10" />
                    <div className="w-6 h-6 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
              
              {/* Dashboard content */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6">
                {/* Chart area */}
                <div className="mb-6 floating-element">
                  <div className="h-48 bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg overflow-hidden">
                    {/* Simulated chart */}
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
                      <path
                        d="M0,40 L5,35 L10,38 L15,30 L20,32 L25,25 L30,28 L35,20 L40,22 L45,15 L50,18 L55,10 L60,12 L65,5 L70,8 L75,3 L80,6 L85,0 L90,4 L95,2 L100,5 L100,40 L0,40 Z"
                        fill="url(#chart-gradient)"
                        opacity="0.3"
                      />
                      <path
                        d="M0,40 L5,35 L10,38 L15,30 L20,32 L25,25 L30,28 L35,20 L40,22 L45,15 L50,18 L55,10 L60,12 L65,5 L70,8 L75,3 L80,6 L85,0 L90,4 L95,2 L100,5"
                        fill="none"
                        stroke="url(#line-gradient)"
                        strokeWidth="0.5"
                      />
                      <defs>
                        <linearGradient id="chart-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ec4899" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#ec4899" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { label: 'Total Profit', value: '+32.5%' },
                    { label: 'Active Strategies', value: '5' },
                    { label: 'Win Rate', value: '78%' },
                    { label: 'Avg. Trade', value: '+2.3%' }
                  ].map((stat, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 floating-element">
                      <div className="text-gray-400 text-xs mb-1">{stat.label}</div>
                      <div className="text-white font-medium">{stat.value}</div>
                    </div>
                  ))}
                </div>
                
                {/* Recent trades */}
                <div className="bg-white/5 rounded-lg p-4 floating-element">
                  <div className="text-gray-200 font-medium mb-3">Recent Trades</div>
                  <div className="space-y-2">
                    {[
                      { pair: 'BTC/USD', type: 'Buy', amount: '0.05', profit: '+2.3%' },
                      { pair: 'ETH/USD', type: 'Sell', amount: '1.2', profit: '+4.7%' },
                      { pair: 'SOL/USD', type: 'Buy', amount: '10', profit: '+1.8%' }
                    ].map((trade, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full ${trade.type === 'Buy' ? 'bg-green-500' : 'bg-red-500'} mr-2`} />
                          <span className="text-white">{trade.pair}</span>
                        </div>
                        <div className="text-gray-400">{trade.amount}</div>
                        <div className="text-green-500">{trade.profit}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full blur-3xl opacity-20 parallax-layer" data-depth="1.5" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full blur-3xl opacity-20 parallax-layer" data-depth="2" />
            
            {/* Floating UI elements */}
            <div className="absolute -right-16 top-1/4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl floating-element parallax-layer" data-depth="1.8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white text-xs">
                  +
                </div>
                <div>
                  <div className="text-white text-sm font-medium">Trade Executed</div>
                  <div className="text-gray-400 text-xs">BTC/USD • +2.3%</div>
                </div>
              </div>
            </div>
            
            <div className="absolute -left-12 bottom-1/4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl floating-element parallax-layer" data-depth="1.5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs">
                  AI
                </div>
                <div>
                  <div className="text-white text-sm font-medium">Strategy Updated</div>
                  <div className="text-gray-400 text-xs">Optimized parameters</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default VisualShowcase;
