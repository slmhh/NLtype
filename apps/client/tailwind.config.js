/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        body: "var(--bg-page)",
        card: "var(--bg-card)",
        "surface-alt": "var(--bg-alt)",
        "surface-ov": "var(--bg-overlay)",
        text: {
          DEFAULT: "var(--text-primary)",
          sub: "var(--text-secondary)",
          muted: "var(--text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          green: "var(--accent-green)",
          red: "var(--accent-red)",
          yellow: "var(--accent-yellow)",
        },
        border: "var(--border)",
      },
      boxShadow: {
        card: "var(--shadow)",
      },
    },
  },
  plugins: [],
};
