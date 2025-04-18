import { Variants } from 'framer-motion';

// Common animation constants
export const STAGGER_DELAY = 0.08;
export const BASE_DURATION = 0.3;
export const SMOOTH_EASE = [0.25, 0.1, 0.25, 1]; // Custom easing for smooth motion

// Smooth fade up animation with subtle movement
export const fadeUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.98
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: SMOOTH_EASE,
      delay: custom * 0.1 // Staggered delay based on index
    }
  }),
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE
    }
  }
};

// Subtle scale animation for cards
export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.97
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: SMOOTH_EASE,
      delay: 0.1 + custom * STAGGER_DELAY // Slightly faster stagger
    }
  }),
  hover: {
    y: -3,
    scale: 1.01,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE
    }
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
      ease: SMOOTH_EASE
    }
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE
    }
  }
};

// Staggered container animation
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER_DELAY,
      delayChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
};

// Button animation
export const buttonVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: BASE_DURATION,
      ease: SMOOTH_EASE
    }
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: SMOOTH_EASE
    }
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1,
      ease: SMOOTH_EASE
    }
  }
};

// Subtle fade for search and filter elements
export const controlsVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -5
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: BASE_DURATION,
      ease: SMOOTH_EASE,
      delay: 0.2 + custom * 0.05
    }
  })
};

// Smooth transition for modal elements
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: SMOOTH_EASE
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: BASE_DURATION,
      ease: SMOOTH_EASE
    }
  }
};

// Subtle list item animation
export const listItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -5
  },
  visible: (custom = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE,
      delay: custom * 0.05
    }
  }),
  exit: {
    opacity: 0,
    x: 5,
    transition: {
      duration: 0.2,
      ease: SMOOTH_EASE
    }
  }
};

// Table row animation
export const tableRowVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 5
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: SMOOTH_EASE,
      delay: custom * 0.03 // Very fast stagger for table rows
    }
  }),
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: SMOOTH_EASE
    }
  }
};

// Page transition animation
export const pageTransitionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: SMOOTH_EASE
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE
    }
  }
};

// Chart container animation
export const chartContainerVariants: Variants = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: SMOOTH_EASE,
      delay: 0.2
    }
  }
};

// Trade card animation
export const tradeCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.98
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE,
      delay: 0.1 + custom * STAGGER_DELAY
    }
  }),
  exit: {
    opacity: 0,
    y: -5,
    transition: {
      duration: 0.2,
      ease: SMOOTH_EASE
    }
  }
};

// Dashboard stat card animation
export const statCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.95
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: SMOOTH_EASE,
      delay: 0.1 + custom * 0.1
    }
  })
};

// Sidebar menu item animation
export const menuItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -10
  },
  visible: (custom = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE,
      delay: 0.1 + custom * 0.05
    }
  }),
  hover: {
    x: 3,
    transition: {
      duration: 0.2,
      ease: SMOOTH_EASE
    }
  }
};

// Toast notification animation
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.8
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: SMOOTH_EASE
    }
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.8,
    transition: {
      duration: 0.3,
      ease: SMOOTH_EASE
    }
  }
};

// ===== UTILITY FUNCTIONS =====

/**
 * Creates a staggered delay based on index for animations
 * @param index The index of the item in a list
 * @param baseDelay Initial delay before starting the stagger
 * @param staggerAmount Amount of delay between each item
 * @returns Calculated delay in seconds
 */
export const getStaggeredDelay = (index: number, baseDelay = 0.1, staggerAmount = STAGGER_DELAY): number => {
  return baseDelay + index * staggerAmount;
};

/**
 * Creates a custom animation variant with specified parameters
 * @param params Custom animation parameters
 * @returns Animation variant object
 */
export const createCustomVariant = (params: {
  initialY?: number;
  initialX?: number;
  initialScale?: number;
  initialOpacity?: number;
  duration?: number;
  staggerDelay?: number;
  ease?: number[];
}): Variants => {
  const {
    initialY = 10,
    initialX = 0,
    initialScale = 1,
    initialOpacity = 0,
    duration = BASE_DURATION,
    staggerDelay = STAGGER_DELAY,
    ease = SMOOTH_EASE
  } = params;

  return {
    hidden: {
      opacity: initialOpacity,
      y: initialY,
      x: initialX,
      scale: initialScale
    },
    visible: (custom = 0) => ({
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: {
        duration,
        ease,
        delay: custom * staggerDelay
      }
    }),
    exit: {
      opacity: 0,
      transition: {
        duration: duration * 0.8,
        ease
      }
    }
  };
};
