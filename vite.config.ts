import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ["sword-spears-economies-speakers.trycloudflare.com", "app.lumenfi.click", "lumenfi.click"]
  }
});
