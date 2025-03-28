import React from 'react';
import { Book, FileText, Code, Terminal, GitBranch, Package } from 'lucide-react';

interface DocSectionProps {
  title: string;
  icon: React.ReactNode;
  description: string;
}

const DocSection: React.FC<DocSectionProps> = ({ title, icon, description }) => (
  <div className="p-4 rounded-lg bg-gunmetal-800 border border-gunmetal-700 hover:border-neon-turquoise/50 transition-colors">
    <div className="flex items-center gap-3 mb-3">
      {icon}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    <p className="text-gray-400">{description}</p>
  </div>
);

export const Documentation: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Documentation</h1>
        <p className="text-gray-400">
          Comprehensive guides and documentation for the trading strategy platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DocSection
          title="Getting Started"
          icon={<Book className="w-6 h-6 text-blue-500" />}
          description="Learn the basics of setting up and configuring your trading strategies."
        />

        <DocSection
          title="Strategy Development"
          icon={<Code className="w-6 h-6 text-green-500" />}
          description="Guide to developing and implementing custom trading strategies."
        />

        <DocSection
          title="API Reference"
          icon={<Terminal className="w-6 h-6 text-purple-500" />}
          description="Complete API documentation for integrating with exchanges and data sources."
        />

        <DocSection
          title="Best Practices"
          icon={<FileText className="w-6 h-6 text-yellow-500" />}
          description="Recommended practices for strategy development and risk management."
        />

        <DocSection
          title="Version Control"
          icon={<GitBranch className="w-6 h-6 text-red-500" />}
          description="Guidelines for managing strategy versions and deployment."
        />

        <DocSection
          title="Dependencies"
          icon={<Package className="w-6 h-6 text-orange-500" />}
          description="Information about third-party libraries and integrations."
        />
      </div>

      <div className="mt-8 p-6 rounded-lg bg-gunmetal-800 border border-gunmetal-700">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            'Strategy Templates',
            'Exchange Integration',
            'Risk Management',
            'Backtesting Guide',
            'Performance Optimization',
            'Troubleshooting'
          ].map((link) => (
            <button
              key={link}
              className="px-4 py-2 text-left rounded bg-gunmetal-700 hover:bg-gunmetal-600 transition-colors text-gray-300 hover:text-white"
            >
              {link}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};