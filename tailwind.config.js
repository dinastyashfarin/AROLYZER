/** @type {import('tailwindcss').Config} */
// The brand tokens live as CSS variables on .page (landing) and .wl (waitlist),
// so every colour below switches with night mode automatically.
export default {
  content: ['./index.html', './waitlist.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '.dark'],
  corePlugins: {
    // The page was designed on browser defaults. Tailwind's reset would shift headings,
    // images and buttons, so it stays off.
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: '#03231B', 2: '#06302A' },
        teal: '#044B39',
        olive: '#264B05',
        mint: '#C7EFC2',
        emerald: '#1DA97A',
        lime: { DEFAULT: '#86D02E', hover: '#76BE22', pale: '#CBF39D' },
        heat: '#E8762C',
        raw: '#A08A5A',
        bg: 'var(--bg)',
        surf: 'var(--surf)',
        card: 'var(--card)',
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink2)' },
        line: 'var(--line)',
        act: { DEFAULT: 'var(--act)', hover: 'var(--act-h)', ink: 'var(--act-ink)' },
        'on-night': { DEFAULT: '#E7F2EB', 2: '#AFCCBA', 3: '#C7DDD0' },
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        text: ['"EB Garamond"', 'Garamond', 'Georgia', 'serif'],
      },
      fontSize: {
        cap: '14px',
        small: '16px',
        body: ['19px', '1.5'],
        lead: 'clamp(21px, 1.2rem + .5vw, 25px)',
        sub: '40px',
        head: 'clamp(52px, 2.2rem + 4.4vw, 104px)',
        display: 'clamp(84px, 9vw, 160px)',
      },
      borderRadius: { brand: '14px' },
      transitionTimingFunction: { out: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      maxWidth: { page: '1360px' },
    },
  },
  plugins: [],
};
