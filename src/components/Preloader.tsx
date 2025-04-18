import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export function Preloader() {
  const [visibilityState, setVisibilityState] = useState<string>(document.visibilityState);

  useEffect(() => {
    // Handle visibility change events
    const handleVisibilityChange = () => {
      setVisibilityState(document.visibilityState);

      // If the page becomes visible again and was previously hidden
      if (document.visibilityState === 'visible' && visibilityState === 'hidden') {
        console.log('Page visibility changed from hidden to visible');
        // Don't reload the page, just update the state
      }
    };

    // Add event listener for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [visibilityState]);
  return (
    <div className="fixed inset-0 bg-gunmetal-950 flex items-center justify-center z-50">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-20 h-20 mx-auto mb-8"
        >
          {/* Outer Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-neon-turquoise via-neon-yellow to-neon-raspberry"
          />

          {/* Inner Shape */}
          <div className="absolute inset-[2px] rounded-xl bg-gunmetal-950 flex items-center justify-center">
            <Zap className="w-10 h-10 text-neon-yellow transform rotate-12" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold mb-4"
        >
          <span className="bg-gradient-to-r from-neon-raspberry via-neon-orange to-neon-yellow bg-clip-text text-transparent">
            GIGAntic
          </span>
        </motion.h1>

        <div className="w-48 h-1 bg-gunmetal-800 rounded-full overflow-hidden mx-auto">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "easeInOut"
            }}
            className="w-full h-full bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry"
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 text-gray-400 text-sm"
        >
          Initializing AI Trading Platform
        </motion.p>
      </div>
    </div>
  );
}
