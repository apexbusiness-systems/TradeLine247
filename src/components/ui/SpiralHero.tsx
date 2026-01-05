/**
 * SpiralHero - CSS-animated spiral SVG component
 * FIX 3: Replaces heavy 3D WebGL canvas (Three.js/Spline Saturn object)
 *
 * Benefits:
 * - Zero JavaScript runtime cost
 * - GPU-accelerated CSS animation (transform: rotate)
 * - 30-second rotation cycle mimics orbital movement
 * - ~3KB SVG vs ~500KB+ 3D library bundle
 * - Respects prefers-reduced-motion
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface SpiralHeroProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

const sizeMap = {
  sm: 'w-32 h-32',
  md: 'w-48 h-48',
  lg: 'w-64 h-64',
  xl: 'w-96 h-96',
};

export const SpiralHero: React.FC<SpiralHeroProps> = ({
  className,
  size = 'lg',
  animated = true,
}) => {
  return (
    <div className={cn('spiral-hero-container', className)}>
      <img
        src="/assets/spiral-hero.svg"
        alt="Decorative spiral animation"
        className={cn(
          sizeMap[size],
          animated && 'spiral-hero',
          'select-none pointer-events-none'
        )}
        aria-hidden="true"
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

export default SpiralHero;
