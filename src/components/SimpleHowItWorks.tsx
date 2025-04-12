import React from 'react';
import { Brain, BarChart2, Zap, Shield, BarChart, Cpu } from 'lucide-react';

export const SimpleHowItWorks: React.FC = () => {
  const steps = [
    {
      icon: <Brain className="w-8 h-8 text-pink-500" />,
      title: "AI Strategy Creation",
      description: "Our advanced AI analyzes market conditions and creates optimized trading strategies tailored to your risk profile."
    },
    {
      icon: <BarChart2 className="w-8 h-8 text-blue-500" />,
      title: "Real-Time Market Analysis",
      description: "Continuous monitoring of market conditions across multiple exchanges to identify the best trading opportunities."
    },
    {
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      title: "Automated Execution",
      description: "Lightning-fast trade execution with precision timing to capitalize on market movements."
    },
    {
      icon: <Shield className="w-8 h-8 text-green-500" />,
      title: "Risk Management",
      description: "Sophisticated risk controls to protect your capital and optimize your portfolio performance."
    },
    {
      icon: <BarChart className="w-8 h-8 text-orange-500" />,
      title: "Performance Analytics",
      description: "Comprehensive analytics dashboard to track your strategy performance and make data-driven decisions."
    },
    {
      icon: <Cpu className="w-8 h-8 text-purple-500" />,
      title: "Continuous Learning",
      description: "Our AI continuously learns from market data and trading outcomes to improve strategy performance over time."
    }
  ];
  
  return (
    <div 
      id="how-it-works"
      className="relative py-20 bg-gray-900"
    >
      {/* Section title */}
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
          How It Works
        </h2>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">
          Our AI-powered platform simplifies crypto trading with a seamless process
        </p>
      </div>
      
      {/* Steps grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-lg bg-gray-700 mr-4">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
              </div>
              <p className="text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SimpleHowItWorks;
