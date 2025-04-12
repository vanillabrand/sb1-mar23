import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface CryptoCoinAnimationProps {
  className?: string;
}

export const CryptoCoinAnimation: React.FC<CryptoCoinAnimationProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const coins = container.querySelectorAll('.crypto-coin');

    // Create random positions for coins
    coins.forEach((coin, index) => {
      // Set initial random positions
      gsap.set(coin, {
        x: Math.random() * window.innerWidth * 0.8 - window.innerWidth * 0.4,
        y: Math.random() * window.innerHeight * 0.8 - window.innerHeight * 0.4,
        z: Math.random() * 500 - 250,
        opacity: 0.05 + Math.random() * 0.15, // Lower opacity for subtle effect
        scale: 0.5 + Math.random() * 1.5,
        rotationY: Math.random() * 360,
        rotationX: Math.random() * 30 - 15
      });

      // Animate each coin with rotation
      gsap.to(coin, {
        rotationY: '+=360',
        duration: 15 + Math.random() * 20, // Slower rotation
        repeat: -1,
        ease: 'none'
      });

      // Create floating animation
      gsap.to(coin, {
        y: `+=${50 + Math.random() * 100}`,
        x: `+=${Math.random() * 50 - 25}`,
        z: `+=${Math.random() * 100 - 50}`,
        opacity: 0.05 + Math.random() * 0.15, // Keep opacity low
        duration: 8 + Math.random() * 12, // Slower movement
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: Math.random() * 5
      });
    });

    // Add parallax effect on mouse move
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const moveX = (clientX - centerX) / centerX;
      const moveY = (clientY - centerY) / centerY;

      coins.forEach((coin, index) => {
        const depth = parseFloat((coin as HTMLElement).style.zIndex) || (index % 3) + 1;
        const moveFactorX = moveX * (depth * 10);
        const moveFactorY = moveY * (depth * 10);

        gsap.to(coin, {
          x: `+=${moveFactorX}`,
          y: `+=${moveFactorY}`,
          duration: 1,
          ease: 'power1.out',
          overwrite: 'auto'
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ perspective: '1000px' }}
    >
      {/* Bitcoin */}
      <div className="crypto-coin absolute" style={{ zIndex: 3 }}>
        <div className="w-16 h-16 rounded-full bg-[#F7931A] flex items-center justify-center text-white font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(247,147,26,0.5)]">
          ₿
        </div>
      </div>

      {/* Ethereum */}
      <div className="crypto-coin absolute" style={{ zIndex: 2 }}>
        <div className="w-16 h-16 rounded-full bg-[#627EEA] flex items-center justify-center text-white font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(98,126,234,0.5)]">
          Ξ
        </div>
      </div>

      {/* Solana */}
      <div className="crypto-coin absolute" style={{ zIndex: 1 }}>
        <div className="w-16 h-16 rounded-full bg-[#00FFA3] flex items-center justify-center text-black font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(0,255,163,0.5)]">
          Ⓢ
        </div>
      </div>

      {/* XRP */}
      <div className="crypto-coin absolute" style={{ zIndex: 2 }}>
        <div className="w-16 h-16 rounded-full bg-[#23292F] flex items-center justify-center text-white font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(35,41,47,0.5)]">
          ✕
        </div>
      </div>

      {/* Luna */}
      <div className="crypto-coin absolute" style={{ zIndex: 1 }}>
        <div className="w-16 h-16 rounded-full bg-[#FFD83D] flex items-center justify-center text-black font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(255,216,61,0.5)]">
          L
        </div>
      </div>

      {/* Dogecoin */}
      <div className="crypto-coin absolute" style={{ zIndex: 2 }}>
        <div className="w-16 h-16 rounded-full bg-[#C2A633] flex items-center justify-center text-white font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(194,166,51,0.5)]">
          Ð
        </div>
      </div>

      {/* Cardano */}
      <div className="crypto-coin absolute" style={{ zIndex: 1 }}>
        <div className="w-16 h-16 rounded-full bg-[#0033AD] flex items-center justify-center text-white font-bold text-2xl transform-gpu shadow-[0_0_15px_rgba(0,51,173,0.5)]">
          ₳
        </div>
      </div>
    </div>
  );
};

export default CryptoCoinAnimation;
