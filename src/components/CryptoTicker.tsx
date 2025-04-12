import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';

interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  icon: string;
}

const initialPrices: CryptoPrice[] = [
  { symbol: 'BTC', price: 65432.10, change24h: 2.5, icon: '₿' },
  { symbol: 'ETH', price: 3456.78, change24h: 1.2, icon: 'Ξ' },
  { symbol: 'SOL', price: 123.45, change24h: 5.7, icon: 'Ⓢ' },
  { symbol: 'XRP', price: 0.5678, change24h: -1.3, icon: '✕' },
  { symbol: 'DOGE', price: 0.1234, change24h: 10.5, icon: 'Ð' },
];

export const CryptoTicker: React.FC = () => {
  const [prices, setPrices] = useState<CryptoPrice[]>(initialPrices);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulate price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(currentPrices =>
        currentPrices.map(crypto => ({
          ...crypto,
          price: crypto.price * (1 + (Math.random() * 0.01 - 0.005)),
          change24h: crypto.change24h + (Math.random() * 0.4 - 0.2)
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Ticker animation
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Create continuous scrolling animation
    gsap.to(container, {
      x: '-100%',
      repeat: -1,
      duration: 20,
      ease: 'linear',
      repeatDelay: 0
    });

    return () => {
      gsap.killTweensOf(container);
    };
  }, []);

  return (
    <div className="w-full bg-gunmetal-900/50 backdrop-blur-md py-2 overflow-hidden border-t border-b border-gunmetal-800/50">
      <div className="relative overflow-hidden">
        <div
          ref={containerRef}
          className="flex items-center space-x-8 whitespace-nowrap"
          style={{ width: 'fit-content' }}
        >
          {/* First set of prices */}
          {prices.map((crypto, index) => (
            <div
              key={`${crypto.symbol}-${index}`}
              className="crypto-item flex items-center space-x-2 px-4"
            >
              <span className="text-xl font-bold">{crypto.icon}</span>
              <span className="font-medium">{crypto.symbol}</span>
              <span className="text-gray-300">${crypto.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: crypto.price < 1 ? 4 : 2
              })}</span>
              <span className={`text-sm ${crypto.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {crypto.change24h >= 0 ? '↑' : '↓'} {Math.abs(crypto.change24h).toFixed(1)}%
              </span>
            </div>
          ))}

          {/* Duplicate set for seamless looping */}
          {prices.map((crypto, index) => (
            <div
              key={`${crypto.symbol}-${index}-dup`}
              className="crypto-item flex items-center space-x-2 px-4"
            >
              <span className="text-xl font-bold">{crypto.icon}</span>
              <span className="font-medium">{crypto.symbol}</span>
              <span className="text-gray-300">${crypto.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: crypto.price < 1 ? 4 : 2
              })}</span>
              <span className={`text-sm ${crypto.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {crypto.change24h >= 0 ? '↑' : '↓'} {Math.abs(crypto.change24h).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CryptoTicker;
