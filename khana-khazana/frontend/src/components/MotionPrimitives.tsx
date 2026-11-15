import React from 'react';
import { motion } from 'motion/react';

interface RaindropHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  asHero?: boolean;
  asPageTitle?: boolean;
  onDark?: boolean;
}

export function RaindropHeader({
  kicker,
  title,
  subtitle,
  align = 'left',
  asHero = false,
  asPageTitle = false,
  onDark = false,
}: RaindropHeaderProps) {
  const isCentered = align === 'center';
  const isAboveFold = asHero || asPageTitle;

  const containerProps = isAboveFold
    ? {
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {
        initial: { opacity: 0, y: -28 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
      };

  const titleColor = onDark ? 'text-white' : 'text-[#111827]';
  const subtitleColor = onDark ? 'text-neutral-200' : 'text-neutral-600';
  const kickerColor = onDark ? 'text-[#FCA5A5]' : 'text-[#DC2626]';

  return (
    <motion.div
      {...containerProps}
      className={isCentered ? 'text-center max-w-3xl mx-auto' : 'max-w-3xl'}
    >
      {kicker && (
        <p
          className={`font-mono text-xs uppercase tracking-[0.22em] font-semibold mb-3 ${kickerColor}`}
        >
          {kicker}
        </p>
      )}

      {asHero ? (
        <h1
          className={`font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] text-balance ${titleColor}`}
        >
          {title}
        </h1>
      ) : asPageTitle ? (
        <h1
          className={`font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] text-balance ${titleColor}`}
        >
          {title}
        </h1>
      ) : (
        <h2
          className={`font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] text-balance ${titleColor}`}
        >
          {title}
        </h2>
      )}

      {subtitle && (
        <p
          className={`mt-4 text-base sm:text-lg leading-relaxed ${subtitleColor} ${
            isCentered ? 'mx-auto max-w-2xl' : 'max-w-2xl'
          }`}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

interface LateralSlideCardProps {
  index: number;
  children: React.ReactNode;
  className?: string;
}

export function LateralSlideCard({
  index,
  children,
  className = '',
}: LateralSlideCardProps) {
  const fromX = index % 2 === 0 ? -48 : 48;

  return (
    <motion.div
      initial={{ opacity: 0, x: fromX }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        type: 'spring',
        stiffness: 110,
        damping: 20,
        delay: Math.min(index * 0.04, 0.16),
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
