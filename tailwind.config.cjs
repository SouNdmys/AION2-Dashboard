/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "rgba(20,20,20,0.6)",
      },
    },
  },
  plugins: [],
};

