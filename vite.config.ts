import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the domain root by default (Vercel, custom domain, local dev).
// The GitHub Pages workflow sets BASE_PATH=/allfit/ (https://victorcesae.github.io/allfit/).
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
});
