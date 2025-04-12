import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import {
  TrendingUp,
  Clock,
  Layers,
  Zap,
  Shield,
  BarChart,
  Cpu,
  Globe,
  LineChart,
  Wallet
} from 'lucide-react';

export const FeaturesSection: React.FC = () => {
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

  const features = [
    {
      icon: <TrendingUp className="w-6 h-6 text-neon-magenta" />,
      title: "AI Strategy Generation",
      description: "Create optimized trading strategies with our advanced AI that adapts to market conditions.",
      delay: 0.1
    },
    {
      icon: <Clock className="w-6 h-6 text-neon-cyan" />,
      title: "24/7 Automated Trading",
      description: "Your strategies run continuously, capturing opportunities even while you sleep.",
      delay: 0.2
    },
    {
      icon: <Layers className="w-6 h-6 text-neon-yellow" />,
      title: "Multi-Exchange Support",
      description: "Trade across multiple exchanges from a single platform with unified analytics.",
      delay: 0.3
    },
    {
      icon: <Zap className="w-6 h-6 text-neon-green" />,
      title: "Real-Time Execution",
      description: "Lightning-fast trade execution with minimal slippage for optimal entry and exit points.",
      delay: 0.4
    },
    {
      icon: <Shield className="w-6 h-6 text-neon-orange" />,
      title: "Advanced Risk Management",
      description: "Sophisticated risk controls to protect your capital and optimize your portfolio.",
      delay: 0.5
    },
    {
      icon: <BarChart className="w-6 h-6 text-neon-pink" />,
      title: "Comprehensive Analytics",
      description: "Detailed performance metrics and visualizations to track your trading success.",
      delay: 0.6
    },
    {
      icon: <Cpu className="w-6 h-6 text-neon-magenta" />,
      title: "Backtesting Engine",
      description: "Test your strategies against historical data before risking real capital.",
      delay: 0.7
    },
    {
      icon: <Globe className="w-6 h-6 text-neon-cyan" />,
      title: "Market Data Integration",
      description: "Access to comprehensive market data and indicators for informed decision-making.",
      delay: 0.8
    },
    {
      icon: <LineChart className="w-6 h-6 text-neon-yellow" />,
      title: "Strategy Templates",
      description: "Choose from a library of pre-built strategies or customize your own.",
      delay: 0.9
    },
    {
      icon: <Wallet className="w-6 h-6 text-neon-green" />,
      title: "Secure API Integration",
      description: "Connect securely to your exchange accounts with read-only API keys for maximum security.",
      delay: 1.0
    }
  ];

  return (
    <div
      id="features"
      ref={sectionRef}
      className="relative py-20 overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(45,212,191,0.05),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,20,147,0.05),transparent_70%)]" />

      {/* Section title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="bg-gradient-to-r from-neon-cyan to-neon-magenta bg-clip-text text-transparent">
            Platform Features
          </span>
        </h2>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">
          Powerful tools designed for both novice and experienced crypto traders
        </p>
      </motion.div>

      {/* Features grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: feature.delay }}
              className="bg-gunmetal-900/30 backdrop-blur-sm rounded-lg p-5 border border-gunmetal-800 hover:border-neon-cyan/30 transition-all duration-300 parallax-layer"
              data-depth={(1 + index * 0.05).toFixed(2)}
            >
              <div className="flex items-center mb-3">
                <div className="p-2 rounded-lg bg-gunmetal-800/50 mr-3">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium text-white">{feature.title}</h3>
              </div>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating elements for visual interest */}
      <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full bg-neon-cyan/5 blur-3xl" />
      <div className="absolute bottom-1/3 left-1/3 w-64 h-64 rounded-full bg-neon-magenta/5 blur-3xl" />
    </div>
  );
};

export default FeaturesSection;
