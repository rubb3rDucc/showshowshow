/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Only emit `hover:`/`group-hover:` styles on devices that actually support
  // hover (`@media (hover: hover)`). Prevents the sticky-hover bug on touch
  // screens where tapping latches `:hover` and it follows scrolling.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}


