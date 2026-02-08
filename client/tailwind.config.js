export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "ui-sans-serif", "system-ui"]
      },
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9ecff",
          200: "#b6d9ff",
          300: "#8bc0ff",
          400: "#60a5ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554"
        }
      }
    }
  },
  plugins: []
};
