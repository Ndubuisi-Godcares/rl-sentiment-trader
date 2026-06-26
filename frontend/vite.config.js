import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: command === "serve"
    ? {
        proxy: {
          "/api": {
            target: "http://localhost:8000",
            rewrite: (path) => path.replace(/^\/api/, ""),
            changeOrigin: true,
          },
        },
      }
    : {},
}));
