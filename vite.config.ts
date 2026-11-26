import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the domain root (Vercel: https://useallfit.vercel.app).
// Set BASE_PATH only if the site ever has to live under a sub-path.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
});
