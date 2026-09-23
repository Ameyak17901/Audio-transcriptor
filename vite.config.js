import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/deepgram": {
        target: "https://api.deepgram.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepgram/, ""),
      },
    },
  },
  define: {
    "process.env": {},
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});
