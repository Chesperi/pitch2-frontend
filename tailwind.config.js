/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        oscine: ["var(--font-oscine)", "system-ui", "sans-serif"],
      },
      colors: {
        "pitch-bg": "#000000",
        "pitch-accent": "#FFFA00",
        "pitch-white": "#FFFFFF",
        "pitch-gray-light": "#F4F4F6",
        "pitch-gray": "#868A8C",
        "pitch-gray-dark": "#3F4547",
      },
    },
  },
  plugins: [],
};
