/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // donation colors
    'bg-cyan-500/10', 'border-cyan-400/30', 'text-cyan-400', 'hover:bg-cyan-500/20',
    'bg-indigo-500/10', 'border-indigo-400/30', 'text-indigo-400', 'hover:bg-indigo-500/20',
    'bg-purple-500/10', 'border-purple-400/30', 'text-purple-400', 'hover:bg-purple-500/20',
    'bg-pink-500/10', 'border-pink-400/30', 'text-pink-400', 'hover:bg-pink-500/20',
    // state colors used in confirm banners
    'bg-green-500/20', 'border-green-400/40', 'text-green-400',
    // layout variants
    'grid-cols-1', 'grid-cols-4', 'w-full',
    // common text sizing we rely on
    'text-xs', 'text-sm',
  ],
};
