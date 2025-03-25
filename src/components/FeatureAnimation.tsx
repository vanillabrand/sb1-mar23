import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Brain, Shield, Target } from 'lucide-react';

interface AnimationProps {
  feature: {
    title: string;
    color: string;
    icon: any;
  };
}

export function FeatureAnimation({ feature }: AnimationProps) {
  const Icon = feature.icon;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  // Feature-specific animations
  const renderFeatureAnimation = () => {
    switch (feature.icon) {
      case Bot:
        return (
          <div className="relative h-full">
            {/* Trading Interface */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1 }}
              className={`absolute inset-0 bg-${feature.color}/10 rounded-xl border border-${feature.color}/20 p-4`}
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="h-2 w-3/4 bg-gunmetal-800 rounded"
                />
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="h-2 w-1/2 bg-gunmetal-800 rounded"
                />
                {/* Trading signals */}
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className={`h-4 w-4 rounded-full bg-${feature.color}`}
                />
              </div>
            </motion.div>
          </div>
        );

      case Brain:
        return (
          <div className="relative h-full">
            {/* Strategy Generation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={`relative w-32 h-32 rounded-full bg-${feature.color}/20`}
              >
                <motion.div
                  animate={{
                    rotate: 360
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Brain className={`w-16 h-16 text-${feature.color}`} />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        );

      default:
        return (
          <div className="relative h-full flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Icon className={`w-24 h-24 text-${feature.color}`} />
            </motion.div>
          </div>
        );
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative aspect-square rounded-xl overflow-hidden bg-gunmetal-900/50 backdrop-blur-xl border border-gunmetal-800"
    >
      {renderFeatureAnimation()}
    </motion.div>
  );
}