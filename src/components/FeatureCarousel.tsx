import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Brain, 
  Shield, 
  Target, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Gauge,
  Zap,
  Globe,
  ArrowRight
} from 'lucide-react';

interface Feature {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  stats?: Array<{
    label: string;
    value: string;
  }>;
  benefits?: string[];
}

const FEATURES: Feature[] = [
  {
    title: "AI Strategy Generation",
    description: "Create custom trading strategies using natural language. Our advanced AI translates your ideas into executable algorithms.",
    icon: Brain,
    color: "neon-raspberry",
    stats: [
      { label: "Success Rate", value: "92%" },
      { label: "Avg. Generation Time", value: "2.5s" }
    ],
    benefits: [
      "Natural language strategy creation",
      "Automatic parameter optimization",
      "Real-time strategy adaptation"
    ]
  },
  {
    title: "Real-time Market Analysis",
    description: "Get instant insights on market trends, volatility, and momentum with our advanced technical analysis engine.",
    icon: TrendingUp,
    color: "neon-orange",
    stats: [
      { label: "Data Points", value: "1M+" },
      { label: "Update Frequency", value: "100ms" }
    ],
    benefits: [
      "Multi-timeframe analysis",
      "Sentiment integration",
      "Volume profile analysis"
    ]
  },
  {
    title: "Risk Management",
    description: "Advanced risk control system that automatically manages position sizing and implements dynamic stop-losses.",
    icon: Shield,
    color: "neon-yellow",
    stats: [
      { label: "Max Drawdown", value: "5.2%" },
      { label: "Win Rate", value: "87%" }
    ],
    benefits: [
      "Dynamic position sizing",
      "Automated stop-loss",
      "Portfolio correlation analysis"
    ]
  },
  {
    title: "Performance Analytics",
    description: "Comprehensive analytics dashboard with detailed performance metrics and trade analysis.",
    icon: Gauge,
    color: "neon-pink",
    stats: [
      { label: "Metrics Tracked", value: "50+" },
      { label: "Report Generation", value: "1s" }
    ],
    benefits: [
      "Trade journal integration",
      "Performance attribution",
      "Risk-adjusted metrics"
    ]
  }
];

export function FeatureCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((current) => (current + 1) % FEATURES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleNext = () => {
    setIsAutoPlaying(false);
    setDirection(1);
    setCurrentIndex((current) => (current + 1) % FEATURES.length);
  };

  const handlePrevious = () => {
    setIsAutoPlaying(false);
    setDirection(-1);
    setCurrentIndex((current) => (current - 1 + FEATURES.length) % FEATURES.length);
  };

  const feature = FEATURES[currentIndex];
  const Icon = feature.icon;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  return (
    <div className="bg-gunmetal-800/20 backdrop-blur-xl rounded-xl overflow-hidden">
      <div className="relative p-8">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Icon className={`w-8 h-8 text-${feature.color}`} />
            <h2 className="text-2xl font-bold gradient-text">Features</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              className="p-3 rounded-lg bg-gunmetal-900/30 text-gray-400 hover:text-white hover:bg-gunmetal-800/30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="p-3 rounded-lg bg-gunmetal-900/30 text-gray-400 hover:text-white hover:bg-gunmetal-800/30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Content */}
        <div className="relative overflow-hidden min-h-[400px]">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="absolute inset-0"
            >
              <div className="space-y-8">
                <div>
                  <h3 className={`text-3xl font-bold text-${feature.color} mb-4`}>
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Stats Grid */}
                {feature.stats && (
                  <div className="grid grid-cols-2 gap-6">
                    {feature.stats.map((stat, index) => (
                      <div key={index} className="bg-gunmetal-900/30 rounded-lg p-6">
                        <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                        <p className="text-sm text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Benefits List */}
                {feature.benefits && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-300">Key Benefits</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {feature.benefits.map((benefit, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-3 bg-gunmetal-900/30 p-4 rounded-lg"
                        >
                          <div className={`w-2 h-2 rounded-full bg-${feature.color}`} />
                          <span className="text-sm text-gray-200">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center mt-8 gap-2">
          {FEATURES.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsAutoPlaying(false);
                setDirection(index > currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? `bg-${FEATURES[index].color} w-8`
                  : 'bg-gunmetal-700 hover:bg-gunmetal-600'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}