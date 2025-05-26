import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ChevronRight, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface EducationalTopic {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

export function EducationalContent() {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const toggleTopic = (topicId: string) => {
    if (expandedTopic === topicId) {
      setExpandedTopic(null);
    } else {
      setExpandedTopic(topicId);
    }
  };

  const educationalTopics: EducationalTopic[] = [
    {
      id: 'crypto-basics',
      title: 'Cryptocurrency Basics',
      description: 'Learn the fundamentals of cryptocurrencies and blockchain technology.',
      content: (
        <div className="space-y-4">
          <p>
            Cryptocurrencies are digital or virtual currencies that use cryptography for security and operate on decentralized networks called blockchains.
          </p>
          <h4 className="font-bold text-neon-turquoise">Key Concepts:</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-medium">Blockchain:</span> A distributed ledger that records all transactions across a network of computers.
            </li>
            <li>
              <span className="font-medium">Decentralization:</span> No central authority controls the network, making it resistant to censorship.
            </li>
            <li>
              <span className="font-medium">Cryptography:</span> Mathematical techniques that secure transactions and control the creation of new units.
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-gunmetal-800">
            <a 
              href="https://www.investopedia.com/terms/c/cryptocurrency.asp" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-turquoise flex items-center gap-1 hover:underline"
            >
              Learn more about cryptocurrencies
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'trading-basics',
      title: 'Trading Fundamentals',
      description: 'Understand the basics of trading cryptocurrencies.',
      content: (
        <div className="space-y-4">
          <p>
            Cryptocurrency trading involves buying and selling digital assets on exchanges to profit from price movements.
          </p>
          <h4 className="font-bold text-neon-yellow">Key Concepts:</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-medium">Market Orders:</span> Buy or sell immediately at the current market price.
            </li>
            <li>
              <span className="font-medium">Limit Orders:</span> Buy or sell at a specific price or better.
            </li>
            <li>
              <span className="font-medium">Stop Orders:</span> Automatically buy or sell when the price reaches a specified level.
            </li>
            <li>
              <span className="font-medium">Trading Pairs:</span> Cryptocurrencies are traded against other cryptocurrencies or fiat currencies (e.g., BTC/USDT).
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-gunmetal-800">
            <a 
              href="https://www.coinbase.com/learn/crypto-basics/what-is-cryptocurrency-trading" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-yellow flex items-center gap-1 hover:underline"
            >
              Learn more about trading basics
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'risk-management',
      title: 'Risk Management',
      description: 'Learn how to protect your investments and manage risk.',
      content: (
        <div className="space-y-4">
          <p>
            Risk management is crucial in cryptocurrency trading due to the high volatility of digital assets.
          </p>
          <h4 className="font-bold text-neon-raspberry">Key Concepts:</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-medium">Position Sizing:</span> Only invest a small percentage of your portfolio in each trade.
            </li>
            <li>
              <span className="font-medium">Stop Loss:</span> Set a price at which you'll automatically sell to limit potential losses.
            </li>
            <li>
              <span className="font-medium">Take Profit:</span> Set a price at which you'll automatically sell to secure profits.
            </li>
            <li>
              <span className="font-medium">Diversification:</span> Spread your investments across different assets to reduce risk.
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-gunmetal-800">
            <a 
              href="https://www.binance.com/en/blog/all/crypto-risk-management-strategies-for-beginners-421499824684903155" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-raspberry flex items-center gap-1 hover:underline"
            >
              Learn more about risk management
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'strategies',
      title: 'Trading Strategies',
      description: 'Explore different approaches to cryptocurrency trading.',
      content: (
        <div className="space-y-4">
          <p>
            Trading strategies are systematic approaches to buying and selling assets based on predefined rules.
          </p>
          <h4 className="font-bold text-neon-green">Common Strategies:</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-medium">Day Trading:</span> Opening and closing positions within the same day.
            </li>
            <li>
              <span className="font-medium">Swing Trading:</span> Holding positions for several days to capture "swings" in price.
            </li>
            <li>
              <span className="font-medium">Position Trading:</span> Holding positions for weeks, months, or even years.
            </li>
            <li>
              <span className="font-medium">Dollar-Cost Averaging:</span> Investing a fixed amount regularly regardless of price.
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-gunmetal-800">
            <a 
              href="https://www.coindesk.com/learn/crypto-trading-strategies-for-beginners/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neon-green flex items-center gap-1 hover:underline"
            >
              Learn more about trading strategies
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-6">
        <GraduationCap className="w-6 h-6 text-neon-turquoise" />
        <h2 className="text-xl font-bold">Learning Center</h2>
      </div>
      
      <p className="text-gray-400 mb-6">
        Expand your knowledge of cryptocurrency trading with these educational resources.
      </p>
      
      <div className="space-y-4">
        {educationalTopics.map((topic) => (
          <div key={topic.id} className="bg-gunmetal-900 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleTopic(topic.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                {topic.icon || <ChevronRight className="w-5 h-5 text-neon-turquoise" />}
                <div>
                  <h3 className="font-medium">{topic.title}</h3>
                  <p className="text-sm text-gray-400">{topic.description}</p>
                </div>
              </div>
              {expandedTopic === topic.id ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedTopic === topic.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-4 pb-4"
              >
                {topic.content}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
