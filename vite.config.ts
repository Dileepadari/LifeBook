import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Port 8082 - workos runs on 8080, moneyos on 8081, so all three can run
// side by side. The /api and /uploads proxies mean the browser only ever
// talks to one origin in dev, so there is no CORS handling anywhere.
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8082,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
