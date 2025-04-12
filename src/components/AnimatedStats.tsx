import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { gsap } from 'gsap';
import { Users, TrendingUp, Clock, Award } from 'lucide-react';

interface Stat {
  icon: React.ReactNode;
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  color: string;
  gradient: string;
}

const stats: Stat[] = [
  {
    icon: <Users className="w-6 h-6" />,
    value: 15000,
    label: "Active traders",
    color: "neon-magenta",
    gradient: "from-neon-magenta/20 to-transparent"
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    value: 32,
    label: "Average ROI",
    suffix: "%",
    color: "neon-cyan",
    gradient: "from-neon-cyan/20 to-transparent"
  },
  {
    icon: <Clock className="w-6 h-6" />,
    value: 24,
    label: "Hours of AI trading",
    suffix: "/7",
    color: "neon-yellow",
    gradient: "from-neon-yellow/20 to-transparent"
  },
  {
    icon: <Award className="w-6 h-6" />,
    value: 5,
    label: "Years of excellence",
    prefix: "+",
    color: "neon-raspberry",
    gradient: "from-neon-raspberry/20 to-transparent"
  }
];

export const AnimatedStats: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  const [hasAnimated, setHasAnimated] = useState(false);

  // Animate numbers when in view
  useEffect(() => {
    if (isInView && !hasAnimated && containerRef.current) {
      setHasAnimated(true);

      const statElements = containerRef.current.querySelectorAll('.stat-value');

      statElements.forEach((element, index) => {
        const stat = stats[index];
        const startValue = 0;
        const endValue = stat.value;

        gsap.fromTo(
          element,
          { innerText: startValue },
          {
            innerText: endValue,
            duration: 2,
            delay: index * 0.2,
            ease: 'power2.out',
            snap: { innerText: 1 },
            onUpdate: function() {
              element.innerHTML = `${stat.prefix || ''}${Math.floor(this.targets()[0].innerText)}${stat.suffix || ''}`;
            }
          }
        );
      });
    }
  }, [isInView, hasAnimated]);

  // Initialize 3D hover effect
  useEffect(() => {
    if (!containerRef.current) return;

    const statCards = containerRef.current.querySelectorAll('.stat-card');

    statCards.forEach(card => {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        gsap.to(card, {
          rotationY: x * 10,
          rotationX: -y * 10,
          transformPerspective: 1000,
          duration: 0.4,
          ease: 'power2.out'
        });

        // Move icon slightly
        const icon = card.querySelector('.stat-icon');
        if (icon) {
          gsap.to(icon, {
            x: x * 15,
            y: y * 15,
            duration: 0.4,
            ease: 'power2.out'
          });
        }
      };

      const handleMouseLeave = () => {
        gsap.to(card, {
          rotationY: 0,
          rotationX: 0,
          duration: 0.7,
          ease: 'elastic.out(1, 0.3)'
        });

        const icon = card.querySelector('.stat-icon');
        if (icon) {
          gsap.to(icon, {
            x: 0,
            y: 0,
            duration: 0.7,
            ease: 'elastic.out(1, 0.3)'
          });
        }
      };

      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
    });
  }, []);

  return (
    <div className="py-20 relative overflow-hidden">
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-medium text-white mb-4">
            Our Impact in Numbers
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            See the real results our AI trading platform has achieved for traders worldwide.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="stat-card relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-6"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Glass reflections */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

              {/* Accent gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10 pointer-events-none`} />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`stat-icon p-3 rounded-full bg-${stat.color}/10 text-${stat.color} mb-4`}>
                  {stat.icon}
                </div>

                <h3 className={`stat-value text-4xl font-bold mb-2 text-${stat.color}`}>
                  {stat.prefix || ''}0{stat.suffix || ''}
                </h3>

                <p className="text-gray-300 text-sm">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimatedStats;
