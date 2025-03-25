import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Target, 
  Shield, 
  Zap,
  ChevronRight,
  Bot,
  BarChart3,
  Coins
} from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: Brain,
      title: "Describe Your Strategy",
      description: "Simply tell GIGAntic what you want to achieve in plain English. Our AI understands your goals and translates them into executable trading strategies.",
      color: "neon-raspberry"
    },
    {
      icon: Bot,
      title: "AI Optimization",
      description: "Our advanced AI analyzes market conditions and optimizes your strategy parameters for maximum performance.",
      color: "neon-turquoise"
    },
    {
      icon: Target,
      title: "Risk Management",
      description: "Built-in risk controls ensure your strategy operates within your comfort zone, protecting your capital.",
      color: "neon-yellow"
    },
    {
      icon: BarChart3,
      title: "Real-time Monitoring",
      description: "Watch your strategy perform in real-time with detailed analytics and performance metrics.",
      color: "neon-orange"
    }
  ];

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast Execution",
      description: "Execute trades instantly with our high-performance infrastructure.",
      color: "neon-yellow"
    },
    {
      icon: Shield,
      title: "Advanced Security",
      description: "Bank-grade encryption and security measures protect your assets.",
      color: "neon-turquoise"
    },
    {
      icon: Coins,
      title: "Multi-Asset Support",
      description: "Trade across multiple cryptocurrencies and markets simultaneously.",
      color: "neon-pink"
    }
  ];

  return (
    <div className="min-h-screen bg-gunmetal-950 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6"
          >
            <span className="gradient-text">Trading Made Simple</span>
            <br />
            <span className="text-white">with AI-Powered Automation</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 max-w-3xl mx-auto"
          >
            From strategy creation to execution, GIGAntic handles everything while you maintain full control.
          </motion.p>
        </div>

        {/* How It Works Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800"
              >
                <div className={`w-12 h-12 rounded-xl bg-${step.color}/10 flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 text-${step.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800"
              >
                <div className={`w-12 h-12 rounded-xl bg-${feature.color}/10 flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 text-${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold gradient-text mb-6">Ready to Start?</h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of traders using AI to master the markets
          </p>
          <button className="flex items-center gap-2 px-8 py-4 bg-neon-raspberry text-white rounded-xl mx-auto hover:bg-[#FF69B4] transition-all duration-300">
            <Brain className="w-6 h-6" />
            <span className="text-lg font-medium">Create Your First Strategy</span>
            <ChevronRight className="w-6 h-6" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}