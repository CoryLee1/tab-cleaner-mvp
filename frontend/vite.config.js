import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: "./public",
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      // 单一占位入口，避免在 dist 里出现无关页面
      input: {
        blank: resolve(__dirname, "public/blank.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
