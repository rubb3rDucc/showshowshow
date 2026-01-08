import { useState, useCallback, useMemo } from 'react';

/**
 * Wave effect configuration
 * Edit these values to change the wave animation across all components
 * Set maxLift to 0 to disable the effect
 */
export const WAVE_CONFIG = {
  /** Maximum lift in pixels for the hovered row (set to 0 to disable) */
  maxLift: 0, // TEMPORARILY DISABLED
  /** Each row lifts this fraction of the previous row (0.5 = 50%) */
  decayFactor: 0.5,
  /** Delay between each row's animation in milliseconds */
  staggerDelay: 250,
  /** Animation duration in milliseconds */
  duration: 300,
  /** CSS easing function */
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Minimum lift threshold - below this, no transform applied */
  minLiftThreshold: 0.5,
} as const;

export interface WaveEffectProps {
  /** Signed distance from hovered row: -2, -1, 0, 1, 2 */
  distanceFromHovered: number;
  /** Whether any row in the list is being hovered */
  isHoveredActive: boolean;
  /** Whether wave is settling (mouse left but animating back down) */
  isSettling?: boolean;
}

export interface WaveEffectStyle {
  transform: string;
  transitionTimingFunction: string;
  transitionDelay: string;
}

/**
 * Calculate wave effect styles for a single row
 * @param distanceFromHovered - Signed distance from the hovered/last-hovered row
 * @param isHoveredActive - Whether mouse is currently hovering
 * @param isSettling - Whether wave is settling back down (uses reverse stagger)
 */
export function getWaveStyle(
  distanceFromHovered: number,
  isHoveredActive: boolean,
  isSettling: boolean = false
): WaveEffectStyle {
  const distance = Math.abs(distanceFromHovered);
  const liftAmount = isHoveredActive
    ? WAVE_CONFIG.maxLift * Math.pow(WAVE_CONFIG.decayFactor, distance)
    : 0;

  // Apply stagger delay for both lift and settle
  // When settling, we want the same wave pattern in reverse
  const staggerDelay = (isHoveredActive || isSettling)
    ? distance * WAVE_CONFIG.staggerDelay
    : 0;

  return {
    transform: liftAmount > WAVE_CONFIG.minLiftThreshold
      ? `translateY(-${liftAmount}px)`
      : 'none',
    transitionTimingFunction: WAVE_CONFIG.easing,
    transitionDelay: `${staggerDelay}ms`,
  };
}

/**
 * Hook to manage wave effect hover state for a list of items
 *
 * Usage:
 * ```tsx
 * const { hoveredIndex, handleMouseEnter, handleMouseLeave, getItemProps } = useWaveEffect();
 *
 * return (
 *   <div onMouseLeave={handleMouseLeave}>
 *     {items.map((item, idx) => (
 *       <div key={item.id} onMouseEnter={() => handleMouseEnter(idx)}>
 *         <ScheduleRow
 *           item={item}
 *           {...getItemProps(idx)}
 *         />
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useWaveEffect() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lastHoveredIndex, setLastHoveredIndex] = useState<number | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const handleMouseEnter = useCallback((index: number) => {
    setIsSettling(false);
    setHoveredIndex(index);
    setLastHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    setIsSettling(true);
    // Clear settling state after animation completes
    // Use max possible delay (furthest item) + duration
    const maxDelay = 5 * WAVE_CONFIG.staggerDelay + WAVE_CONFIG.duration;
    setTimeout(() => {
      setIsSettling(false);
      setLastHoveredIndex(null);
    }, maxDelay);
  }, []);

  const getItemProps = useCallback((index: number): WaveEffectProps => {
    // Use lastHoveredIndex when settling to maintain wave pattern
    const referenceIndex = hoveredIndex ?? lastHoveredIndex;
    return {
      distanceFromHovered: referenceIndex !== null ? index - referenceIndex : 0,
      isHoveredActive: hoveredIndex !== null,
      isSettling: isSettling && hoveredIndex === null,
    };
  }, [hoveredIndex, lastHoveredIndex, isSettling]);

  return {
    hoveredIndex,
    handleMouseEnter,
    handleMouseLeave,
    getItemProps,
  };
}

/**
 * Hook to get wave effect styles directly (for components that need more control)
 */
export function useWaveStyle(distanceFromHovered: number, isHoveredActive: boolean) {
  return useMemo(
    () => getWaveStyle(distanceFromHovered, isHoveredActive),
    [distanceFromHovered, isHoveredActive]
  );
}
