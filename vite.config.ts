import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 5173,
    middlewareMode: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/baixa-clientes": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
      },
      "/nfse": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
      },
    },
  },
  appType: "spa",
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
