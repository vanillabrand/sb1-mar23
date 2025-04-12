import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface GiganticLogoProps {
  className?: string;
}

export function KilnLogo({ className = "" }: GiganticLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Mark */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="relative w-10 h-10"
      >
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-turquoise via-neon-yellow to-neon-raspberry" />

        {/* Inner Shape */}
        <div className="absolute inset-[2px] rounded-lg bg-gunmetal-950 flex items-center justify-center">
          <Zap className="w-6 h-6 text-neon-yellow transform rotate-12" />
        </div>

        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-turquoise/20 via-neon-yellow/20 to-neon-raspberry/20 blur-xl" />
      </motion.div>

      {/* Text */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl gradient-text"
        >
          GIGAntic
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-gray-400"
        >
          AI Trading Platform
        </motion.p>
      </div>
    </div>
  );
}