import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Static output: bisa di-deploy ke Vercel, Netlify, Cloudflare Pages, atau hosting biasa.
export default defineConfig({
  integrations: [react()],
});
