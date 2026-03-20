import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { resolveWorkflowWebDevServerConfig } from "./src/dev-server-config.js";

const devServerConfig = resolveWorkflowWebDevServerConfig();

export default defineConfig({
  plugins: [react()],
  server: {
    port: devServerConfig.webPort,
    strictPort: true,
    proxy: {
      "/api": {
        changeOrigin: true,
        target: devServerConfig.apiOrigin
      }
    }
  }
});
