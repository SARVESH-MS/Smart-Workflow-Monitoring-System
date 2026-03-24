import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
            return "react-vendor";
          }
          if (id.includes("chart.js") || id.includes("react-chartjs-2")) {
            return "charts";
          }
          if (id.includes("socket.io-client")) {
            return "socket";
          }
          if (id.includes("axios") || id.includes("dayjs")) {
            return "utils-vendor";
          }
          return "vendor";
        }
      }
    }
  }
});
