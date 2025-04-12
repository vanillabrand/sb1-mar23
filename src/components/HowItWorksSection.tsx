import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Brain, BarChart2, Zap, Shield, BarChart, Cpu } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    // Create parallax effect on mouse move
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = sectionRef.current!.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;

      // Move elements with different intensities
      const layers = sectionRef.current!.querySelectorAll('.parallax-layer');
      layers.forEach((layer) => {
        const depth = parseFloat((layer as HTMLElement).dataset.depth || '1');
        gsap.to(layer, {
          x: x * 30 * depth,
          y: y * 20 * depth,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });
    };

    sectionRef.current.addEventListener('mousemove', handleMouseMove);

    return () => {
      sectionRef.current?.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const steps = [
    {
      icon: <Brain className="w-8 h-8 text-neon-magenta" />,
      title: "AI Strategy Creation",
      description: "Our advanced AI analyzes market conditions and creates optimized trading strategies tailored to your risk profile.",
      delay: 0.1
    },
    {
      icon: <BarChart2 className="w-8 h-8 text-neon-cyan" />,
      title: "Real-Time Market Analysis",
      description: "Continuous monitoring of market conditions across multiple exchanges to identify the best trading opportunities.",
      delay: 0.2
    },
    {
      icon: <Zap className="w-8 h-8 text-neon-yellow" />,
      title: "Automated Execution",
      description: "Lightning-fast trade execution with precision timing to capitalize on market movements.",
      delay: 0.3
    },
    {
      icon: <Shield className="w-8 h-8 text-neon-green" />,
      title: "Risk Management",
      description: "Sophisticated risk controls to protect your capital and optimize your portfolio performance.",
      delay: 0.4
    },
    {
      icon: <BarChart className="w-8 h-8 text-neon-orange" />,
      title: "Performance Analytics",
      description: "Comprehensive analytics dashboard to track your strategy performance and make data-driven decisions.",
      delay: 0.5
    },
    {
      icon: <Cpu className="w-8 h-8 text-neon-pink" />,
      title: "Continuous Learning",
      description: "Our AI continuously learns from market data and trading outcomes to improve strategy performance over time.",
      delay: 0.6
    }
  ];

  return (
    <div
      id="how-it-works"
      ref={sectionRef}
      className="relative py-20 overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.05),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,20,147,0.05),transparent_70%)]" />

      {/* Section title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="bg-gradient-to-r from-neon-magenta to-neon-cyan bg-clip-text text-transparent">
            How It Works
          </span>
        </h2>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">
          Our AI-powered platform simplifies crypto trading with a seamless process
        </p>
      </motion.div>

      {/* Steps grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: step.delay }}
              className="bg-gunmetal-900/50 backdrop-blur-sm rounded-xl p-6 border border-gunmetal-800 hover:border-neon-cyan/30 transition-all duration-300 parallax-layer"
              data-depth={(1 + index * 0.1).toFixed(1)}
            >
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-lg bg-gunmetal-800/50 mr-4">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
              </div>
              <p className="text-gray-400">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating elements for visual interest */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-neon-magenta/5 blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full bg-neon-cyan/5 blur-3xl" />
    </div>
  );
};

export default HowItWorksSection;
