import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAnimationConfig, AnimationType } from '../../hooks/useAnimationConfig';

interface AnimatedPanelProps {
  children: ReactNode;
  className?: string;
  index?: number;
  delay?: number;
  type?: AnimationType;
  as?: React.ElementType;
  onClick?: () => void;
}

/**
 * A reusable animated panel component that applies smooth animations
 * to its children with configurable animation types and delays.
 */
export const AnimatedPanel: React.FC<AnimatedPanelProps> = ({
  children,
  className = '',
  index = 0,
  delay = 0,
  type = 'fadeUp',
  as = 'div',
  onClick,
  ...props
}) => {
  const animation = useAnimationConfig(type);

  return (
    <motion.div
      className={`${className}`}
      custom={index}
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      // Removed hover and tap animations
      transition={{
        delay: delay + index * 0.1,
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * A container component that staggers the animations of its children
 */
interface AnimatedContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  as?: React.ElementType;
}

export const AnimatedContainer: React.FC<AnimatedContainerProps> = ({
  children,
  className = '',
  delay = 0,
  staggerDelay = 0.08,
  as = 'div',
  ...props
}) => {
  const animation = useAnimationConfig('staggerContainer');

  return (
    <motion.div
      className={className}
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      transition={{
        delayChildren: delay,
        staggerChildren: staggerDelay,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * A card component with smooth animations and hover effects
 */
interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  index?: number;
  delay?: number;
  onClick?: () => void;
  interactive?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  index = 0,
  delay = 0,
  onClick,
  interactive = true,
  ...props
}) => {
  const animation = useAnimationConfig('card');

  return (
    <motion.div
      className={`${className}`}
      custom={index}
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      // Removed hover and tap animations
      transition={{
        delay: delay + index * 0.08,
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * An animated button with hover and tap effects
 */
interface AnimatedButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  delay?: number;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  delay = 0,
  ...props
}) => {
  const animation = useAnimationConfig('button');

  return (
    <motion.button
      className={className}
      type={type}
      onClick={onClick}
      disabled={disabled}
      initial={animation.initial}
      animate={animation.animate}
      // Removed hover and tap animations
      transition={{
        delay,
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
};

/**
 * An animated list item with subtle entrance animation
 */
interface AnimatedListItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
  delay?: number;
  onClick?: () => void;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  className = '',
  index = 0,
  delay = 0,
  onClick,
  ...props
}) => {
  const animation = useAnimationConfig('listItem');

  return (
    <motion.li
      className={className}
      custom={index}
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      transition={{
        delay: delay + index * 0.05,
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.li>
  );
};

export default AnimatedPanel;
