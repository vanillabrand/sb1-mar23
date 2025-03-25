import React from 'react';
import { Trophy, Star, Award, Medal } from 'lucide-react';

const AWARDS = [
  {
    icon: Trophy,
    title: "Best Crypto Trading Innovation 2024",
    organization: "Crypto Trading Journal",
    description: "Recognized for revolutionary AI-driven trading strategies",
    color: "neon-turquoise"
  },
  {
    icon: Star,
    title: "Excellence in Trading Technology",
    organization: "Global FinTech Awards",
    description: "Outstanding achievement in algorithmic trading solutions",
    color: "neon-yellow"
  },
  {
    icon: Award,
    title: "Most Innovative Trading Platform",
    organization: "Digital Asset Summit",
    description: "Leading the way in AI-powered trading automation",
    color: "neon-orange"
  },
  {
    icon: Medal,
    title: "Best Risk Management Solution",
    organization: "Institutional Trading Awards",
    description: "Setting new standards in automated risk control",
    color: "neon-pink"
  }
];

export function Awards() {
  return (
    <div className="py-24 bg-gunmetal-900/50 backdrop-blur-xl border-y border-gunmetal-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Award-Winning Platform</h2>
          <p className="text-xl text-gray-400">
            Recognized by leading industry experts and institutions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {AWARDS.map((award, index) => {
            const Icon = award.icon;
            return (
              <div
                key={index}
                className="group relative bg-gunmetal-900/90 backdrop-blur-xl rounded-xl p-6 border border-gunmetal-800 hover:border-neon-turquoise/50 transform hover:scale-105 transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-${award.color}/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl bg-${award.color}/10 flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 text-${award.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{award.title}</h3>
                  <p className={`text-sm text-${award.color} mb-2`}>
                    {award.organization}
                  </p>
                  <p className="text-sm text-gray-400">
                    {award.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}