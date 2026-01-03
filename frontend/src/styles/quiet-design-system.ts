/**
 * Quiet Utility Design System
 *
 * Single source of truth for design tokens following quiet utility philosophy:
 * - Time is visually dominant
 * - Hierarchy via typography and spacing (not color/decoration)
 * - One accent color for meaningful states only
 * - Calm, predictable, utilitarian
 */

export const QuietDesign = {
  colors: {
    // Single accent color - use ONLY for meaningful states
    accent: '#646cff',

    // Grayscale palette
    gray: {
      50: '#fafafa',   // Backgrounds (page, timeline blocks)
      200: '#e5e7eb',  // Borders (subtle, 1px)
      300: '#d1d5db',  // Checkbox borders
      400: '#9ca3af',  // Tertiary text (metadata, duration)
      500: '#6b7280',  // Secondary text (episode info)
      900: '#111827',  // Primary text (time, titles)
    },

    white: '#ffffff',  // Card backgrounds

    // Watched state
    watched: {
      opacity: 0.3,
      filter: 'grayscale(100%)',
    },
  },

  typography: {
    sizes: {
      time: '36px',      // Schedule card time (visually dominant)
      title: '20px',     // Content titles
      body: '14px',      // Episode info, timeline block titles
      metadata: '12px',  // Metadata, duration, timestamps
    },

    weights: {
      bold: 700,         // Time, primary emphasis
      medium: 500,       // Titles
      regular: 400,      // Body text, metadata
    },

    lineHeights: {
      compact: 1.2,      // Headings
      normal: 1.5,       // Body text
    },
  },

  spacing: {
    cardGap: '24px',      // Between cards (breathing room)
    cardPadding: '16px',  // Card internal padding
    sectionGap: '32px',   // Between sections
    textGap: '12px',      // Between text lines
    metadataGap: '8px',   // Between metadata items
  },

  borders: {
    radius: {
      card: '8px',     // Cards, timeline blocks
      poster: '4px',   // Posters
      circle: '50%',   // Checkboxes
    },

    width: {
      default: '1px',  // Default borders (NOT 2px)
      focus: '2px',    // Focus/active states only
    },
  },

  transitions: {
    fast: '200ms ease',    // Checkbox, button interactions
    normal: '300ms ease',  // Fade, filter transitions
  },

  poster: {
    card: {
      width: '48px',
      height: '72px',
    },
    timeline: {
      size: '32px',  // Circular avatar
    },
    queue: {
      width: '40px',
      height: '60px',
    },
  },

  checkbox: {
    size: '24px',
    iconSize: '14px',
  },
} as const;

// Export individual sections for convenience
export const colors = QuietDesign.colors;
export const typography = QuietDesign.typography;
export const spacing = QuietDesign.spacing;
export const borders = QuietDesign.borders;
export const transitions = QuietDesign.transitions;
export const poster = QuietDesign.poster;
export const checkbox = QuietDesign.checkbox;
