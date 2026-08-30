import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        storefront: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin/index.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      // Uploaded images are served by the Worker, not from disk — without this
      // every photo added in the admin is a broken image in `npm run dev`.
      "/images": "http://127.0.0.1:8787",
    },
  },
});
