import React from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Rocket,
  Zap,
  Crown,
  Building2,
  Mail
} from 'lucide-react';

interface PricingPanelProps {
  onSelectPlan?: (plan: string) => void;
}

export function PricingPanel({ onSelectPlan }: PricingPanelProps) {
  const handlePlanSelect = (planName: string) => {
    if (onSelectPlan) {
      onSelectPlan(planName);
    }
  };

  return (
    <div className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Choose Your Trading Power</h2>
          <p className="text-xl text-gray-400">
            Select the plan that best fits your trading ambitions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PRICING_TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`panel-metallic relative rounded-xl p-6 ${
                  tier.popular ? 'ring-2 ring-neon-yellow' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-neon-yellow text-gunmetal-950 text-sm font-semibold rounded-full">
                    Most Popular
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-${tier.color}/10 flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 text-${tier.color}`} />
                </div>

                <h3 className="text-xl font-bold text-gray-200 mb-2">{tier.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{tier.description}</p>

                <div className="mb-6">
                  {tier.price > 0 ? (
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-gray-200">$</span>
                      <span className="text-4xl font-bold text-gray-200">{tier.price}</span>
                      <span className="text-gray-400 ml-2">/month</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-bold text-gray-200">Custom Pricing</div>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className={`w-5 h-5 text-${tier.color}`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(tier.name)}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 bg-${tier.color}/10 text-${tier.color} rounded-lg hover:bg-${tier.color}/20 transition-all duration-300 group`}
                >
                  {tier.price > 0 ? (
                    <>
                      Get Started
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : (
                    <>
                      Contact Sales
                      <Mail className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-400">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}

const PRICING_TIERS = [
  {
    name: "Starter",
    price: 29.99,
    description: "Perfect for beginners exploring AI trading",
    icon: Rocket,
    color: "neon-turquoise",
    features: [
      "1 Active Trading Strategy",
      "Basic AI Strategy Generation",
      "Real-time Market Analysis",
      "Email Support",
      "Basic Risk Management",
      "Standard API Access"
    ]
  },
  {
    name: "Pro",
    price: 49.99,
    description: "For serious traders seeking an edge",
    icon: Zap,
    color: "neon-yellow",
    popular: true,
    features: [
      "3 Active Trading Strategies",
      "Advanced AI Strategy Generation",
      "Real-time Market Analysis",
      "Priority Support",
      "Advanced Risk Management",
      "Premium API Access",
      "Performance Analytics",
      "Strategy Backtesting"
    ]
  },
  {
    name: "Grandmaster",
    price: 99.99,
    description: "Ultimate trading power for professionals",
    icon: Crown,
    color: "neon-orange",
    features: [
      "Unlimited Active Strategies",
      "Expert AI Strategy Generation",
      "Real-time Market Analysis",
      "24/7 Priority Support",
      "Advanced Risk Management",
      "Premium API Access",
      "Advanced Analytics Suite",
      "Unlimited Backtesting",
      "Custom Indicators",
      "VIP Trading Community"
    ]
  },
  {
    name: "Enterprise",
    price: 0,
    description: "Custom solutions for institutions",
    icon: Building2,
    color: "neon-pink",
    features: [
      "Custom Strategy Development",
      "Dedicated Account Manager",
      "Custom API Integration",
      "SLA Guarantees",
      "White-label Solutions",
      "Custom Risk Parameters",
      "Multi-user Access",
      "Advanced Reporting"
    ]
  }
];