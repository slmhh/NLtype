/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#1e1e2e",
          alt: "#181825",
          overlay: "#313244",
        },
        text: {
          DEFAULT: "#cdd6f4",
          muted: "#6c7086",
        },
        accent: {
          DEFAULT: "#89b4fa",
          green: "#a6e3a1",
          red: "#f38ba8",
          yellow: "#f9e2af",
        },
      },
    },
  },
  plugins: [],
};