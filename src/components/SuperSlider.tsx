import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export function SuperSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const features: Feature[] = [
    {
      title: "AI-Powered Strategy Generator",
      description: "Create custom trading strategies using natural language. Our AI translates your ideas into executable algorithms.",
      icon: "🧠",
      color: "neon-turquoise"
    },
    {
      title: "Real-time Market Analysis",
      description: "Get instant insights on market trends, volatility, and momentum to make informed trading decisions.",
      icon: "📊",
      color: "neon-yellow"
    },
    {
      title: "Advanced Risk Management",
      description: "Set custom risk parameters and let our system automatically manage position sizing and stop-losses.",
      icon: "🛡️",
      color: "neon-orange"
    },
    {
      title: "Backtesting & Optimization",
      description: "Test your strategies against historical data and optimize parameters for maximum performance.",
      icon: "⏱️",
      color: "neon-pink"
    }
  ];

  const nextFeature = () => {
    setCurrentIndex((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setCurrentIndex((prev) => (prev - 1 + features.length) % features.length);
  };

  const feature = features[currentIndex];

  return (
    <div className="bg-gunmetal-900/40 backdrop-blur-xl rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold gradient-text">Key Features</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevFeature}
            className="p-2 rounded-full bg-gunmetal-800/30 text-gray-400 hover:text-white hover:bg-gunmetal-700/30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextFeature}
            className="p-2 rounded-full bg-gunmetal-800/30 text-gray-400 hover:text-white hover:bg-gunmetal-700/30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden min-h-[200px]">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className={`bg-gunmetal-800/30 rounded-lg p-6`}
        >
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 text-4xl`}>
              {feature.icon}
            </div>
            <div>
              <h3 className={`text-lg font-semibold text-${feature.color} mb-2`}>
                {feature.title}
              </h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-center mt-4 gap-2">
        {features.map((_, i) => (
          <button
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentIndex
                ? `bg-${features[i].color} w-6`
                : 'bg-gunmetal-700 hover:bg-gunmetal-600'
            }`}
            onClick={() => setCurrentIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}