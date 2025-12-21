/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  safelist: [
    // Pastel colors - all variants
    {
      pattern: /(bg|text|border)-(pastel-mint|pastel-pink|pastel-blue|pastel-yellow|pastel-purple|brutal-gray|brutal-black|brutal-white)/,
      variants: ['hover'],
    },
    // If you add new pastel colors, add them to the pattern above:
    // pattern: /(bg|text|border)-(pastel-mint|pastel-pink|pastel-blue|pastel-yellow|pastel-purple|...)/,
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          mint: '#00ff9f',
          pink: '#ff6b9d',
          blue: '#89cff0',
          yellow: '#fdfd96',
          purple: '#c5a3ff',
          // Add more pastel colors here:
          // orange: '#ffb347',
          // green: '#90ee90',
        },
        brutal: {
          black: '#000000',
          white: '#ffffff',
          gray: '#f5f5f5',
        },
        // Legacy aliases for backward compatibility
        'mint': '#00ff9f',
        'pink': '#ff6b9d',
        'blue': '#89cff0',
        'yellow': '#fdfd96',
        'bg-light': '#f5f5f5',
        'brutal-gray': '#f5f5f5',
        'pastel-mint': '#00ff9f',
        'pastel-pink': '#ff6b9d',
        'pastel-blue': '#89cff0',
        'pastel-yellow': '#fdfd96',
        'pastel-orange': '#fdd096',
        'pastel-purple': '#c5a3ff',
        // Add more legacy aliases here if needed:
      },
      fontFamily: {
        mono: ['"Space Mono"', '"JetBrains Mono"', 'monospace'],
        sans: ['"Space Mono"', 'monospace'], // Force monospace as default
        'mono-bold': ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'hard': '8px 8px 0px 0px #000000',
        'hard-sm': '4px 4px 0px 0px #000000',
        'hard-xl': '12px 12px 0px 0px #000000',
      },
      borderWidth: {
        '3': '3px',
        '6': '6px',
      },
      backgroundImage: {
        'barcode': "linear-gradient(90deg, #000 2px, transparent 2px, #000 4px, transparent 4px, transparent 6px, #000 6px, #000 10px, transparent 10px, transparent 14px, #000 14px)",
        'grid-pattern': "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
}
